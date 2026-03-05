import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { sendError } from "../utils/response";

// Express requires all 4 params to identify this as an error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
    // Zod validation errors
    if (err instanceof ZodError) {
        sendError(res, "Validation failed", 400, "VALIDATION_ERROR", err.flatten().fieldErrors);
        return;
    }

    // Prisma known errors (e.g. unique constraint)
    if (err?.name === "PrismaClientKnownRequestError") {
        if (err.code === "P2002") {
            const field = err.meta?.target?.[0];
            if (field) console.warn(`P2002 duplicate on field: ${field}`);
            sendError(res, "A record with this value already exists", 409, "DUPLICATE_ENTRY");
            return;
        }
        if (err.code === "P2025") {
            sendError(res, "Record not found", 404, "NOT_FOUND");
            return;
        }
    }

    // Log unexpected errors
    console.error(err);

    const status = err.status || 500;
    const message = status === 500 ? "Internal Server Error" : err.message;
    sendError(res, message, status, "SERVER_ERROR");
}
