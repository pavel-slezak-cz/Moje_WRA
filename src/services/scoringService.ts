import type { PrismaClient } from "../generated/prisma/client";
import type { ScaleType, MeasurementType } from "../generated/prisma/enums";

const SCORING_MODEL_VERSION = "1.0";

// ── Types ──

interface ItemMeta {
    id: number;
    constructId: number;
    scaleType: ScaleType;
    reverseScored: boolean;
    measurementType: MeasurementType;
    gapGroupId: string | null;
}

interface RawAnswer {
    itemId: number;
    value: number;
}

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

// ── Main scoring orchestrator ──

/**
 * Computes all scores for a response inside the provided transaction.
 * Receives pre-loaded item metadata and the raw answers.
 * Does NOT modify ResponseItem rows.
 */
export async function scoreResponse(
    tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    responseId: number,
    items: ItemMeta[],
    rawAnswers: RawAnswer[],
) {
    // 1. Build scored-value map (apply reverse scoring)
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const scoredValues = new Map<number, number>();

    for (const ans of rawAnswers) {
        const meta = itemMap.get(ans.itemId)!;
        const scored = meta.reverseScored
            ? reverseScore(ans.value, meta.scaleType)
            : ans.value;
        scoredValues.set(ans.itemId, scored);
    }

    // 2. Compute item-level scores (SOURCE/TARGET + GAP pairing)
    //    Group items by gapGroupId to find pairs
    const gapGroups = new Map<string, { source?: ItemMeta; target?: ItemMeta }>();
    for (const item of items) {
        if (item.gapGroupId) {
            const group = gapGroups.get(item.gapGroupId) ?? {};
            if (item.measurementType === "SOURCE") group.source = item;
            else group.target = item;
            gapGroups.set(item.gapGroupId, group);
        }
    }

    const itemScoreData = items.map((item) => {
        const scored = scoredValues.get(item.id)!;
        let sourceValue: number | null = null;
        let targetValue: number | null = null;
        let gapValue: number | null = null;

        if (item.measurementType === "SOURCE") {
            sourceValue = scored;
        } else {
            targetValue = scored;
        }

        // If this item has a gap pair, compute gapValue
        if (item.gapGroupId) {
            const pair = gapGroups.get(item.gapGroupId)!;
            if (pair.source && pair.target) {
                const sv = scoredValues.get(pair.source.id)!;
                const tv = scoredValues.get(pair.target.id)!;
                gapValue = tv - sv;
            }
        }

        return {
            responseId,
            itemId: item.id,
            sourceValue,
            targetValue,
            gapValue,
        };
    });

    await tx.itemScore.createMany({ data: itemScoreData });

    // 3. Construct-level scoring
    const constructGroups = new Map<number, { sourceVals: number[]; targetVals: number[] }>();
    for (const item of items) {
        const group = constructGroups.get(item.constructId)
            ?? { sourceVals: [], targetVals: [] };
        const scored = scoredValues.get(item.id)!;

        if (item.measurementType === "SOURCE") {
            group.sourceVals.push(scored);
        } else {
            group.targetVals.push(scored);
        }
        constructGroups.set(item.constructId, group);
    }

    const constructScoreData = Array.from(constructGroups.entries()).map(
        ([constructId, { sourceVals, targetVals }]) => {
            const sourceMean = mean(sourceVals);
            const targetMean = mean(targetVals);
            const gapMean =
                sourceMean !== null && targetMean !== null
                    ? targetMean - sourceMean
                    : null;

            return {
                responseId,
                constructId,
                sourceMean,
                targetMean,
                gapMean,
                scoringModelVersion: SCORING_MODEL_VERSION,
            };
        },
    );

    await tx.constructScore.createMany({ data: constructScoreData });

    // 4. Global score
    const allSource = constructScoreData
        .map((c) => c.sourceMean)
        .filter((v): v is number => v !== null);
    const allTarget = constructScoreData
        .map((c) => c.targetMean)
        .filter((v): v is number => v !== null);

    const globalSourceMean = mean(allSource);
    const globalTargetMean = mean(allTarget);
    const globalGapMean =
        globalSourceMean !== null && globalTargetMean !== null
            ? globalTargetMean - globalSourceMean
            : null;

    await tx.globalScore.create({
        data: {
            responseId,
            globalSourceMean,
            globalTargetMean,
            globalGapMean,
            scoringModelVersion: SCORING_MODEL_VERSION,
        },
    });
}
