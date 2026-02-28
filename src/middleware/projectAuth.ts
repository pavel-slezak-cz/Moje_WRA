import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { sendError } from "../utils/response";
import { ProjectRole } from "../generated/prisma/enums";

export interface ProjectParticipantInfo {
    projectId: number;
    userId: number;
    role: ProjectRole;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            projectParticipant?: ProjectParticipantInfo;
        }
    }
}

/**
 * Middleware factory: checks that the authenticated user is a participant
 * in the project identified by :id, and has one of the allowed roles.
 */
export function requireProjectRole(...allowedRoles: ProjectRole[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const projectId = parseInt(req.params.id as string, 10);
        if (isNaN(projectId)) {
            sendError(res, "Invalid project ID", 400, "INVALID_ID");
            return;
        }

        const participant = await prisma.projectParticipant.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: req.user!.userId,
                },
            },
        });

        if (!participant) {
            sendError(res, "You are not a member of this project", 403, "NOT_PROJECT_MEMBER");
            return;
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(participant.role as ProjectRole)) {
            sendError(res, "Insufficient project permissions", 403, "INSUFFICIENT_ROLE");
            return;
        }

        req.projectParticipant = {
            projectId,
            userId: participant.userId,
            role: participant.role as ProjectRole,
        };

        next();
    };
}
