import { z } from "zod";
import { Request, Response, NextFunction } from "express";

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

// ── Generic validation middleware ──

export function validate(schema: z.ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                error: "Validation failed",
                details: result.error.flatten().fieldErrors,
            });
            return;
        }
        req.body = result.data;
        next();
    };
}
