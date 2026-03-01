import type { PrismaClient } from "../generated/prisma/client";
import type { ScaleType, ScoringStrategy, BehaviorPolarity } from "../generated/prisma/enums";
import type { NormalizedRow } from "../middleware/validate";
import { SCALE_META, normalizeValue, normalizeGap } from "../config/scaleConfig";

const SCORING_MODEL_VERSION = "1.1";

// ── Types ──

interface ItemMeta {
    id: number;
    constructId: number;
    scaleType: ScaleType;
    reverseScored: boolean;
    behaviorPolarity: BehaviorPolarity | null;
}

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// ── Reverse scoring ──

export function reverseScore(value: number, scaleType: ScaleType): number {
    const meta = SCALE_META[scaleType];
    return meta?.reverseMax ? meta.reverseMax - value : value;
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
    rows: NormalizedRow[],
) {
    if (strategy === "WRA_ABSOLUTE_GAP") {
        return scoreWRA(tx, responseId, items, rows);
    } else {
        return score360(tx, responseId, items, rows);
    }
}

// ── WRA_ABSOLUTE_GAP scoring ──
// Pairs SOURCE + TARGET by itemId from normalized rows.
// One ItemScore per item.

async function scoreWRA(tx: Tx, responseId: number, items: ItemMeta[], rows: NormalizedRow[]) {
    const itemMap = new Map(items.map((i) => [i.id, i]));

    // Build scored values keyed by (itemId, channel)
    const scored = new Map<string, number>(); // key: "itemId:channel"
    for (const r of rows) {
        const meta = itemMap.get(r.itemId);
        if (!meta) throw new Error(`Scoring error: no metadata for item ${r.itemId}`);
        const val = meta.reverseScored ? reverseScore(r.value, meta.scaleType) : r.value;
        scored.set(`${r.itemId}:${r.channel}`, val);
    }

    // Unique item IDs (each item gets one ItemScore)
    const uniqueItemIds = [...new Set(rows.map((r) => r.itemId))];

    const itemScoreData = uniqueItemIds.map((itemId) => {
        const meta = itemMap.get(itemId);
        const sv = scored.get(`${itemId}:SOURCE`) ?? null;
        const tv = scored.get(`${itemId}:TARGET`) ?? null;
        const gapValue = sv !== null && tv !== null ? tv - sv : null;
        const absoluteGapValue = gapValue !== null ? Math.abs(gapValue) : null;

        // Normalized values — based on scored (post-reverse) values for correct construct aggregation
        const scaleType = meta?.scaleType ?? "LIKERT_5";
        const normalizedSource = sv !== null ? normalizeValue(sv, scaleType) : null;
        const normalizedTarget = tv !== null ? normalizeValue(tv, scaleType) : null;
        const normalizedGapVal = sv !== null && tv !== null ? normalizeGap(sv, tv, scaleType) : null;

        return {
            responseId, itemId, sourceValue: sv, targetValue: tv, gapValue, absoluteGapValue,
            normalizedSource, normalizedTarget, normalizedGap: normalizedGapVal,
        };
    });

    await tx.itemScore.createMany({ data: itemScoreData });

    // Construct scores
    const constructGroups = new Map<number, {
        sourceVals: number[]; targetVals: number[]; absGaps: number[];
        normSourceVals: number[]; normTargetVals: number[]; normGapVals: number[];
    }>();
    for (const isd of itemScoreData) {
        const meta = itemMap.get(isd.itemId);
        if (!meta) throw new Error(`Scoring error: no metadata for item ${isd.itemId}`);
        const group = constructGroups.get(meta.constructId) ?? {
            sourceVals: [], targetVals: [], absGaps: [],
            normSourceVals: [], normTargetVals: [], normGapVals: [],
        };
        if (isd.sourceValue !== null) group.sourceVals.push(isd.sourceValue);
        if (isd.targetValue !== null) group.targetVals.push(isd.targetValue);
        if (isd.absoluteGapValue !== null) group.absGaps.push(isd.absoluteGapValue);
        if (isd.normalizedSource !== null) group.normSourceVals.push(isd.normalizedSource);
        if (isd.normalizedTarget !== null) group.normTargetVals.push(isd.normalizedTarget);
        if (isd.normalizedGap !== null) group.normGapVals.push(isd.normalizedGap);
        constructGroups.set(meta.constructId, group);
    }

    const constructScoreData = Array.from(constructGroups.entries()).map(
        ([constructId, { sourceVals, targetVals, absGaps, normSourceVals, normTargetVals, normGapVals }]) => {
            const sourceMean = mean(sourceVals);
            const targetMean = mean(targetVals);
            const gapMean = sourceMean !== null && targetMean !== null ? targetMean - sourceMean : null;
            const meanAbsoluteGap = mean(absGaps);
            return {
                responseId, constructId, sourceMean, targetMean, gapMean, meanAbsoluteGap,
                normalizedSourceMean: mean(normSourceVals),
                normalizedTargetMean: mean(normTargetVals),
                normalizedGapMean: mean(normGapVals),
                scoringModelVersion: SCORING_MODEL_VERSION,
            };
        },
    );

    await tx.constructScore.createMany({ data: constructScoreData });

    // Global
    const allSource = constructScoreData.map((c) => c.sourceMean).filter((v): v is number => v !== null);
    const allTarget = constructScoreData.map((c) => c.targetMean).filter((v): v is number => v !== null);
    const allAbsGap = constructScoreData.map((c) => c.meanAbsoluteGap).filter((v): v is number => v !== null);
    const globalSourceMean = mean(allSource);
    const globalTargetMean = mean(allTarget);

    const allNormSource = constructScoreData.map((c) => c.normalizedSourceMean).filter((v): v is number => v !== null);
    const allNormTarget = constructScoreData.map((c) => c.normalizedTargetMean).filter((v): v is number => v !== null);
    const allNormGap = constructScoreData.map((c) => c.normalizedGapMean).filter((v): v is number => v !== null);

    await tx.globalScore.create({
        data: {
            responseId,
            globalSourceMean,
            globalTargetMean,
            globalGapMean: globalSourceMean !== null && globalTargetMean !== null ? globalTargetMean - globalSourceMean : null,
            globalMeanAbsoluteGap: mean(allAbsGap),
            normalizedGlobalSourceMean: mean(allNormSource),
            normalizedGlobalTargetMean: mean(allNormTarget),
            normalizedGlobalGapMean: mean(allNormGap),
            scoringModelVersion: SCORING_MODEL_VERSION,
        },
    });
}

// ── NORMATIVE_360 scoring ──

async function score360(tx: Tx, responseId: number, items: ItemMeta[], rows: NormalizedRow[]) {
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const normalizedValues = new Map<number, number>();

    for (const r of rows) {
        const meta = itemMap.get(r.itemId);
        if (!meta) throw new Error(`Scoring error: no metadata for item ${r.itemId}`);
        // NEGATIVE polarity: flip 0↔1
        const normalized = meta.behaviorPolarity === "NEGATIVE" ? 1 - r.value : r.value;
        normalizedValues.set(r.itemId, normalized);
    }

    // Item scores — store normalized in sourceValue, no target/gap
    const itemScoreData = items.map((item) => {
        const v = normalizedValues.get(item.id);
        if (v == null) throw new Error(`Scoring error: missing normalized value for item ${item.id}`);
        return {
            responseId,
            itemId: item.id,
            sourceValue: v,
            targetValue: null,
            gapValue: null,
            absoluteGapValue: null,
        };
    });

    await tx.itemScore.createMany({ data: itemScoreData });

    // Construct scores — mean of normalized values
    const constructGroups = new Map<number, number[]>();
    for (const item of items) {
        const v = normalizedValues.get(item.id);
        if (v == null) throw new Error(`Scoring error: missing normalized value for item ${item.id}`);
        const arr = constructGroups.get(item.constructId) ?? [];
        arr.push(v);
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
