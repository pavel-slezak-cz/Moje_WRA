import type { PrismaClient } from "../generated/prisma/client";
import type { ScaleType, MeasurementType, ScoringStrategy, BehaviorPolarity } from "../generated/prisma/enums";

const SCORING_MODEL_VERSION = "1.0";

// ── Types ──

interface ItemMeta {
    id: number;
    constructId: number;
    scaleType: ScaleType;
    reverseScored: boolean;
    measurementType: MeasurementType;
    gapGroupId: string | null;
    behaviorPolarity: BehaviorPolarity | null;
}

interface RawAnswer {
    itemId: number;
    value: number;
}

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// ── Reverse scoring ──

const REVERSE_MAX: Record<string, number> = {
    LIKERT_5: 6,
    LIKERT_7: 8,
};

export function reverseScore(value: number, scaleType: ScaleType): number {
    const max = REVERSE_MAX[scaleType];
    return max ? max - value : value;
}

// ── Helpers ──

function mean(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

// ── Main orchestrator ──

export async function scoreResponse(
    tx: Tx,
    responseId: number,
    strategy: ScoringStrategy,
    items: ItemMeta[],
    rawAnswers: RawAnswer[],
) {
    if (strategy === "WRA_ABSOLUTE_GAP") {
        return scoreWRA(tx, responseId, items, rawAnswers);
    } else {
        return score360(tx, responseId, items, rawAnswers);
    }
}

// ── WRA_ABSOLUTE_GAP scoring ──

async function scoreWRA(tx: Tx, responseId: number, items: ItemMeta[], rawAnswers: RawAnswer[]) {
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const scoredValues = new Map<number, number>();

    for (const ans of rawAnswers) {
        const meta = itemMap.get(ans.itemId)!;
        const scored = meta.reverseScored ? reverseScore(ans.value, meta.scaleType) : ans.value;
        scoredValues.set(ans.itemId, scored);
    }

    // Gap groups
    const gapGroups = new Map<string, { source?: ItemMeta; target?: ItemMeta }>();
    for (const item of items) {
        if (item.gapGroupId) {
            const group = gapGroups.get(item.gapGroupId) ?? {};
            if (item.measurementType === "SOURCE") group.source = item;
            else group.target = item;
            gapGroups.set(item.gapGroupId, group);
        }
    }

    // Item scores
    const itemScoreData = items.map((item) => {
        const scored = scoredValues.get(item.id)!;
        let sourceValue: number | null = null;
        let targetValue: number | null = null;
        let gapValue: number | null = null;
        let absoluteGapValue: number | null = null;

        if (item.measurementType === "SOURCE") sourceValue = scored;
        else targetValue = scored;

        if (item.gapGroupId) {
            const pair = gapGroups.get(item.gapGroupId)!;
            if (pair.source && pair.target) {
                const sv = scoredValues.get(pair.source.id)!;
                const tv = scoredValues.get(pair.target.id)!;
                gapValue = tv - sv;
                absoluteGapValue = Math.abs(gapValue);
            }
        }

        return { responseId, itemId: item.id, sourceValue, targetValue, gapValue, absoluteGapValue };
    });

    await tx.itemScore.createMany({ data: itemScoreData });

    // Construct scores
    const constructGroups = new Map<number, { sourceVals: number[]; targetVals: number[]; absGaps: number[] }>();
    for (const item of items) {
        const group = constructGroups.get(item.constructId) ?? { sourceVals: [], targetVals: [], absGaps: [] };
        const scored = scoredValues.get(item.id)!;
        if (item.measurementType === "SOURCE") group.sourceVals.push(scored);
        else group.targetVals.push(scored);
        constructGroups.set(item.constructId, group);
    }
    // Collect absolute gaps per construct (one per gap group)
    for (const [, pair] of gapGroups) {
        if (pair.source && pair.target) {
            const sv = scoredValues.get(pair.source.id)!;
            const tv = scoredValues.get(pair.target.id)!;
            const cGroup = constructGroups.get(pair.source.constructId)!;
            cGroup.absGaps.push(Math.abs(tv - sv));
        }
    }

    const constructScoreData = Array.from(constructGroups.entries()).map(
        ([constructId, { sourceVals, targetVals, absGaps }]) => {
            const sourceMean = mean(sourceVals);
            const targetMean = mean(targetVals);
            const gapMean = sourceMean !== null && targetMean !== null ? targetMean - sourceMean : null;
            const meanAbsoluteGap = mean(absGaps);
            return { responseId, constructId, sourceMean, targetMean, gapMean, meanAbsoluteGap, scoringModelVersion: SCORING_MODEL_VERSION };
        },
    );

    await tx.constructScore.createMany({ data: constructScoreData });

    // Global
    const allSource = constructScoreData.map((c) => c.sourceMean).filter((v): v is number => v !== null);
    const allTarget = constructScoreData.map((c) => c.targetMean).filter((v): v is number => v !== null);
    const allAbsGap = constructScoreData.map((c) => c.meanAbsoluteGap).filter((v): v is number => v !== null);
    const globalSourceMean = mean(allSource);
    const globalTargetMean = mean(allTarget);

    await tx.globalScore.create({
        data: {
            responseId,
            globalSourceMean,
            globalTargetMean,
            globalGapMean: globalSourceMean !== null && globalTargetMean !== null ? globalTargetMean - globalSourceMean : null,
            globalMeanAbsoluteGap: mean(allAbsGap),
            scoringModelVersion: SCORING_MODEL_VERSION,
        },
    });
}

// ── NORMATIVE_360 scoring ──

async function score360(tx: Tx, responseId: number, items: ItemMeta[], rawAnswers: RawAnswer[]) {
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const normalizedValues = new Map<number, number>();

    for (const ans of rawAnswers) {
        const meta = itemMap.get(ans.itemId)!;
        // NEGATIVE polarity: flip 0↔1
        const normalized = meta.behaviorPolarity === "NEGATIVE" ? 1 - ans.value : ans.value;
        normalizedValues.set(ans.itemId, normalized);
    }

    // Item scores — store normalized in sourceValue, no target/gap
    const itemScoreData = items.map((item) => ({
        responseId,
        itemId: item.id,
        sourceValue: normalizedValues.get(item.id)!,
        targetValue: null,
        gapValue: null,
        absoluteGapValue: null,
    }));

    await tx.itemScore.createMany({ data: itemScoreData });

    // Construct scores — mean of normalized values
    const constructGroups = new Map<number, number[]>();
    for (const item of items) {
        const arr = constructGroups.get(item.constructId) ?? [];
        arr.push(normalizedValues.get(item.id)!);
        constructGroups.set(item.constructId, arr);
    }

    const constructScoreData = Array.from(constructGroups.entries()).map(
        ([constructId, vals]) => ({
            responseId,
            constructId,
            sourceMean: mean(vals),
            targetMean: null,
            gapMean: null,
            meanAbsoluteGap: null,
            scoringModelVersion: SCORING_MODEL_VERSION,
        }),
    );

    await tx.constructScore.createMany({ data: constructScoreData });

    // Global
    const allMeans = constructScoreData.map((c) => c.sourceMean).filter((v): v is number => v !== null);

    await tx.globalScore.create({
        data: {
            responseId,
            globalSourceMean: mean(allMeans),
            globalTargetMean: null,
            globalGapMean: null,
            globalMeanAbsoluteGap: null,
            scoringModelVersion: SCORING_MODEL_VERSION,
        },
    });
}
