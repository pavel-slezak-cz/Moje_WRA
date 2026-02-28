import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { sendError } from "../utils/response";

/**
 * Middleware that gates DB Inspector access.
 * Requires:
 *   1. DB_INSPECTOR_ENABLED === "true"
 *   2. req.user.email is in DB_INSPECTOR_ALLOWLIST (comma-separated)
 * Returns 404 on failure (hides existence of inspector).
 */
export function inspectorGuard(req: Request, res: Response, next: NextFunction) {
    if (env.DB_INSPECTOR_ENABLED !== "true") {
        sendError(res, "Endpoint not found", 404, "NOT_FOUND");
        return;
    }

    const allowlist = env.DB_INSPECTOR_ALLOWLIST
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

    const userEmail = req.user?.email?.toLowerCase() ?? "";

    if (!userEmail || !allowlist.includes(userEmail)) {
        sendError(res, "Endpoint not found", 404, "NOT_FOUND");
        return;
    }

    next();
}

/**
 * Helper to check inspector access without blocking (for config endpoint).
 */
export function isInspectorAllowed(email: string): boolean {
    if (env.DB_INSPECTOR_ENABLED !== "true") return false;
    const allowlist = env.DB_INSPECTOR_ALLOWLIST
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    return allowlist.includes(email.toLowerCase());
}
