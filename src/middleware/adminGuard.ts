import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { sendError } from "../utils/response";

/**
 * Requires SUPERUSER role. Returns 403 SUPERUSER_ONLY otherwise.
 */
export function requireSuperuser(req: Request, res: Response, next: NextFunction) {
    if (req.user?.role !== "SUPERUSER") {
        sendError(res, "Superuser access required", 403, "SUPERUSER_ONLY");
        return;
    }
    next();
}

/**
 * Requires SUPERUSER or STAFF role. Returns 403 ADMIN_ACCESS_DENIED otherwise.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const role = req.user?.role;
    if (role !== "SUPERUSER" && role !== "STAFF") {
        sendError(res, "Admin access denied", 403, "ADMIN_ACCESS_DENIED");
        return;
    }
    next();
}

/**
 * Project-scoped admin access. Extracts projectId from req.params.projectId.
 * SUPERUSER: passes. STAFF: checks ProjectStaffAccess. RESPONDENT: 403.
 */
export async function requireProjectAdminAccess(req: Request, res: Response, next: NextFunction) {
    try {
        const role = req.user?.role;
        const userId = req.user?.userId;

        if (role === "SUPERUSER") { next(); return; }

        if (role !== "STAFF" || !userId) {
            sendError(res, "Admin access denied", 403, "ADMIN_ACCESS_DENIED");
            return;
        }

        const projectId = parseInt(req.params.projectId as string, 10);
        if (isNaN(projectId)) {
            sendError(res, "Invalid project ID", 400, "INVALID_ID");
            return;
        }

        const access = await prisma.projectStaffAccess.findUnique({
            where: { userId_projectId: { userId, projectId } },
            select: { id: true },
        });

        if (!access) {
            sendError(res, "No admin access to this project", 403, "PROJECT_ADMIN_ACCESS_DENIED");
            return;
        }

        next();
    } catch (err) {
        next(err);
    }
}

/**
 * Assignment-scoped access. Extracts assignment ID from req.params.id.
 * Checks respondentUserId === req.user.userId. SUPERUSER bypasses.
 */
export async function requireAssignmentOwner(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            sendError(res, "Authentication required", 401, "AUTH_REQUIRED");
            return;
        }

        const assignmentId = parseInt(req.params.id as string, 10);
        if (isNaN(assignmentId)) {
            sendError(res, "Invalid assignment ID", 400, "INVALID_ID");
            return;
        }

        const assignment = await prisma.evaluationAssignment.findUnique({
            where: { id: assignmentId },
            select: { id: true, respondentUserId: true, projectId: true },
        });

        if (!assignment) {
            sendError(res, "Assignment not found", 404, "NOT_FOUND");
            return;
        }

        if (req.user?.role === "SUPERUSER") { next(); return; }

        if (assignment.respondentUserId !== userId) {
            sendError(res, "Not your assignment", 403, "ASSIGNMENT_ACCESS_DENIED");
            return;
        }

        next();
    } catch (err) {
        next(err);
    }
}
