import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response";

// ── Schemas ──

export const registerSchema = z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    name: z.string().min(1, "Name is required"),
});

export const loginSchema = z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(1, "Password is required"),
});

export const submitResponseSchema = z.object({
    answers: z.record(z.string(), z.unknown()),
});

// ── Format A: { itemId, source, target? } (UI-friendly)
const formatAItem = z.object({
    itemId: z.number().int().positive(),
    source: z.number().int(),
    target: z.number().int().optional(),
});

// ── Format B: { itemId, channel, value } (raw rows)
const formatBItem = z.object({
    itemId: z.number().int().positive(),
    channel: z.enum(["SOURCE", "TARGET"]),
    value: z.number().int(),
});

export interface NormalizedRow {
    itemId: number;
    channel: "SOURCE" | "TARGET";
    value: number;
}

function normalizeItems(items: unknown[]): NormalizedRow[] {
    const rows: NormalizedRow[] = [];
    for (const item of items) {
        const obj = item as Record<string, unknown>;
        if ("channel" in obj && "value" in obj) {
            // Format B
            const parsed = formatBItem.parse(obj);
            rows.push({ itemId: parsed.itemId, channel: parsed.channel, value: parsed.value });
        } else {
            // Format A
            const parsed = formatAItem.parse(obj);
            rows.push({ itemId: parsed.itemId, channel: "SOURCE", value: parsed.source });
            if (parsed.target !== undefined) {
                rows.push({ itemId: parsed.itemId, channel: "TARGET", value: parsed.target });
            }
        }
    }
    return rows;
}

export const submitInstrumentResponseSchema = z.object({
    items: z.array(z.unknown()).min(1, "At least one item response is required"),
    assignmentId: z.number().int().positive().optional(),
}).transform((data) => ({
    rows: normalizeItems(data.items),
    assignmentId: data.assignmentId,
}));

export const createProjectSchema = z.object({
    name: z.string().min(1, "Project name is required"),
    description: z.string().optional(),
    instrumentVersionId: z.number().int().positive("Instrument version ID is required"),
});

export const addParticipantSchema = z.object({
    userId: z.number().int().positive("User ID is required"),
    role: z.enum(["ADMIN", "PARTICIPANT"]).optional(),
});

// ── Admin schemas ──

export const createInstrumentSchema = z.object({
    name: z.string().min(1, "Instrument name is required"),
    description: z.string().optional(),
});

export const updateInstrumentSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
});

export const createVersionSchema = z.object({
    versionNumber: z.string().min(1, "Version number is required"),
    scoringStrategy: z.enum(["WRA_ABSOLUTE_GAP", "NORMATIVE_360"]),
});

export const updateVersionSchema = z.object({
    isActive: z.boolean().optional(),
    scoringStrategy: z.enum(["WRA_ABSOLUTE_GAP", "NORMATIVE_360"]).optional(),
});

export const cloneVersionSchema = z.object({
    versionNumber: z.string().min(1, "New version number is required"),
});

export const createConstructSchema = z.object({
    name: z.string().min(1, "Construct name is required"),
    description: z.string().optional(),
});

export const updateConstructSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
});

const scaleTypeEnum = z.enum(["LIKERT_5", "LIKERT_7", "TEXT", "YES_NO", "SCALE_3", "SCALE_6", "SCALE_10"]);
const labelSetEnum = z.enum(["AGREEMENT", "FREQUENCY", "QUALITY", "IMPORTANCE"]);

export const createItemSchema = z.object({
    constructId: z.number().int().positive("Construct ID is required"),
    text: z.string().min(1, "Item text is required"),
    scaleType: scaleTypeEnum.optional(),
    labelSet: labelSetEnum.nullable().optional(),
    reverseScored: z.boolean().optional(),
    behaviorPolarity: z.enum(["POSITIVE", "NEGATIVE"]).nullable().optional(),
});

export const updateItemSchema = z.object({
    text: z.string().min(1).optional(),
    scaleType: scaleTypeEnum.optional(),
    labelSet: labelSetEnum.nullable().optional(),
    reverseScored: z.boolean().optional(),
    behaviorPolarity: z.enum(["POSITIVE", "NEGATIVE"]).nullable().optional(),
});

export const reorderItemsSchema = z.object({
    itemIds: z.array(z.number().int().positive()).min(1, "At least one item ID required"),
});

// Helper: treat empty strings as undefined for optional fields
const optionalString = (min: number, msg?: string) =>
    z.preprocess((v) => (v === "" ? undefined : v), z.string().min(min, msg).optional());

export const addParticipantByEmailSchema = z.object({
    email: z.string().email("Valid email is required"),
    name: optionalString(1, "Name is required for new users"),
    password: optionalString(6, "Password must be at least 6 characters"),
    role: z.enum(["ADMIN", "PARTICIPANT"]).optional(),
});

export const createAssignmentSchema = z.object({
    evaluatorUserId: z.number().int().positive("Evaluator user ID is required"),
    targetUserId: z.number().int().positive("Target user ID is required"),
    relationship: z.enum(["SELF", "MANAGER", "PEER", "SUBORDINATE"]),
});

// ── Generic validation middleware ──

export function validate(schema: z.ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            sendError(res, "Validation failed", 400, "VALIDATION_ERROR", result.error.flatten().fieldErrors);
            return;
        }
        req.body = result.data;
        next();
    };
}
