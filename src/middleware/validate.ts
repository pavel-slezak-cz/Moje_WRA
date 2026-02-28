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
}).transform((data) => ({
    rows: normalizeItems(data.items),
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
