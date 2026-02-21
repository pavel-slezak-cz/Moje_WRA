import { Response } from "express";

/**
 * Standard API response format:
 *
 * Success: { success: true, data: T }
 * Error:   { success: false, error: { message: string, code?: string, details?: unknown } }
 */

export function sendSuccess<T>(res: Response, data: T, status = 200) {
    res.status(status).json({ success: true, data });
}

export function sendError(
    res: Response,
    message: string,
    status = 400,
    code?: string,
    details?: unknown,
) {
    const error: { message: string; code?: string; details?: unknown } = { message };
    if (code) error.code = code;
    if (details) error.details = details;

    res.status(status).json({ success: false, error });
}
