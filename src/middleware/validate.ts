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

export const submitInstrumentResponseSchema = z.object({
    items: z.array(z.object({
        itemId: z.number().int().positive("Item ID must be a positive integer"),
        value: z.number().int("Value must be an integer"),
    })).min(1, "At least one item response is required"),
});

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
