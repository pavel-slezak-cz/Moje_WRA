import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { sendError } from "../utils/response";

/**
 * Middleware that restricts /admin routes to users who are OWNER
 * of at least one project. Must be placed AFTER authMiddleware.
 */
export async function requireOwner(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            sendError(res, "Authentication required", 401, "AUTH_REQUIRED");
            return;
        }

        const ownerRecord = await prisma.projectParticipant.findFirst({
            where: { userId, role: "OWNER" },
            select: { id: true },
        });

        if (!ownerRecord) {
            sendError(res, "Admin access denied", 403, "ADMIN_ACCESS_DENIED");
            return;
        }

        next();
    } catch (err) {
        next(err);
    }
}
