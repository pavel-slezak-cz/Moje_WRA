import type { ScaleType } from "../generated/prisma/enums";

// ── Scale metadata ──

export interface ScaleMeta {
    min: number;
    max: number;
    reverseMax: number | null; // max + 1 for reverse scoring; null = not reversible
    values: number[];
}

export const SCALE_META: Record<ScaleType, ScaleMeta> = {
    YES_NO:   { min: 0,  max: 1,  reverseMax: null, values: [0, 1] },
    LIKERT_5: { min: 1,  max: 5,  reverseMax: 6,    values: [1, 2, 3, 4, 5] },
    SCALE_3:  { min: 1,  max: 3,  reverseMax: 4,    values: [1, 2, 3] },
    LIKERT_7: { min: 1,  max: 7,  reverseMax: 8,    values: [1, 2, 3, 4, 5, 6, 7] },
    SCALE_6:  { min: 1,  max: 6,  reverseMax: 7,    values: [1, 2, 3, 4, 5, 6] },
    SCALE_10: { min: 1,  max: 10, reverseMax: 11,   values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    TEXT:     { min: 0,  max: 0,  reverseMax: null, values: [] },
};

// ── Normalization helpers ──
// Formula: normalizedValue = (rawValue - min) / (max - min)
// Returns null for TEXT or when the scale range is zero.

export function normalizeValue(raw: number, scaleType: ScaleType): number | null {
    const meta = SCALE_META[scaleType];
    if (!meta || scaleType === "TEXT") return null;
    const range = meta.max - meta.min;
    if (range === 0) return null;
    return (raw - meta.min) / range;
}

export function normalizeGap(rawSource: number, rawTarget: number, scaleType: ScaleType): number | null {
    const meta = SCALE_META[scaleType];
    if (!meta || scaleType === "TEXT") return null;
    const range = meta.max - meta.min;
    if (range === 0) return null;
    return (rawTarget - rawSource) / range;
}

// ── Label map ──
// Key: "LABEL_SET:SCALE_TYPE" → array of { value, label } in ascending order.
// Only supported (labelSet, scaleType) combinations are listed.
// Missing combo → client falls back to raw numbers.

export interface ScaleLabel {
    value: number;
    label: string;
}

type LabelKey = `${string}:${string}`;

const LABEL_MAP: Record<LabelKey, ScaleLabel[]> = {
    // ── AGREEMENT ──
    "AGREEMENT:SCALE_3":  [{ value: 1, label: "Nesouhlasím" }, { value: 2, label: "Neutrální" }, { value: 3, label: "Souhlasím" }],
    "AGREEMENT:LIKERT_5": [{ value: 1, label: "Silně nesouhlasím" }, { value: 2, label: "Nesouhlasím" }, { value: 3, label: "Neutrální" }, { value: 4, label: "Souhlasím" }, { value: 5, label: "Silně souhlasím" }],
    "AGREEMENT:SCALE_6":  [{ value: 1, label: "Silně nesouhlasím" }, { value: 2, label: "Nesouhlasím" }, { value: 3, label: "Spíše nesouhlasím" }, { value: 4, label: "Spíše souhlasím" }, { value: 5, label: "Souhlasím" }, { value: 6, label: "Silně souhlasím" }],
    "AGREEMENT:LIKERT_7": [{ value: 1, label: "Silně nesouhlasím" }, { value: 2, label: "Nesouhlasím" }, { value: 3, label: "Spíše nesouhlasím" }, { value: 4, label: "Neutrální" }, { value: 5, label: "Spíše souhlasím" }, { value: 6, label: "Souhlasím" }, { value: 7, label: "Silně souhlasím" }],

    // ── FREQUENCY ──
    "FREQUENCY:SCALE_3":  [{ value: 1, label: "Nikdy" }, { value: 2, label: "Někdy" }, { value: 3, label: "Vždy" }],
    "FREQUENCY:LIKERT_5": [{ value: 1, label: "Nikdy" }, { value: 2, label: "Zřídka" }, { value: 3, label: "Někdy" }, { value: 4, label: "Často" }, { value: 5, label: "Vždy" }],
    "FREQUENCY:SCALE_6":  [{ value: 1, label: "Nikdy" }, { value: 2, label: "Velmi zřídka" }, { value: 3, label: "Zřídka" }, { value: 4, label: "Někdy" }, { value: 5, label: "Často" }, { value: 6, label: "Vždy" }],
    "FREQUENCY:LIKERT_7": [{ value: 1, label: "Nikdy" }, { value: 2, label: "Velmi zřídka" }, { value: 3, label: "Zřídka" }, { value: 4, label: "Někdy" }, { value: 5, label: "Často" }, { value: 6, label: "Velmi často" }, { value: 7, label: "Vždy" }],

    // ── QUALITY ──
    "QUALITY:SCALE_3":  [{ value: 1, label: "Špatné" }, { value: 2, label: "Průměrné" }, { value: 3, label: "Výborné" }],
    "QUALITY:LIKERT_5": [{ value: 1, label: "Velmi špatné" }, { value: 2, label: "Špatné" }, { value: 3, label: "Průměrné" }, { value: 4, label: "Dobré" }, { value: 5, label: "Výborné" }],
    "QUALITY:SCALE_6":  [{ value: 1, label: "Velmi špatné" }, { value: 2, label: "Špatné" }, { value: 3, label: "Podprůměrné" }, { value: 4, label: "Průměrné" }, { value: 5, label: "Dobré" }, { value: 6, label: "Výborné" }],
    "QUALITY:LIKERT_7": [{ value: 1, label: "Velmi špatné" }, { value: 2, label: "Špatné" }, { value: 3, label: "Podprůměrné" }, { value: 4, label: "Průměrné" }, { value: 5, label: "Nadprůměrné" }, { value: 6, label: "Dobré" }, { value: 7, label: "Výborné" }],

    // ── IMPORTANCE ──
    "IMPORTANCE:SCALE_3":  [{ value: 1, label: "Nedůležité" }, { value: 2, label: "Neutrální" }, { value: 3, label: "Důležité" }],
    "IMPORTANCE:LIKERT_5": [{ value: 1, label: "Nedůležité" }, { value: 2, label: "Málo důležité" }, { value: 3, label: "Neutrální" }, { value: 4, label: "Důležité" }, { value: 5, label: "Velmi důležité" }],
    "IMPORTANCE:SCALE_6":  [{ value: 1, label: "Zcela nedůležité" }, { value: 2, label: "Nedůležité" }, { value: 3, label: "Málo důležité" }, { value: 4, label: "Poměrně důležité" }, { value: 5, label: "Důležité" }, { value: 6, label: "Velmi důležité" }],
    "IMPORTANCE:LIKERT_7": [{ value: 1, label: "Zcela nedůležité" }, { value: 2, label: "Nedůležité" }, { value: 3, label: "Málo důležité" }, { value: 4, label: "Neutrální" }, { value: 5, label: "Poměrně důležité" }, { value: 6, label: "Důležité" }, { value: 7, label: "Velmi důležité" }],
};

/**
 * Resolve labels for a (labelSet, scaleType) combination.
 * Returns undefined when no labels are defined → client should show raw numbers.
 */
export function getLabels(labelSet: string | null | undefined, scaleType: ScaleType): ScaleLabel[] | undefined {
    if (!labelSet) return undefined;
    return LABEL_MAP[`${labelSet}:${scaleType}` as LabelKey];
}
