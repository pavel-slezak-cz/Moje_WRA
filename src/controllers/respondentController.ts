import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { sendSuccess, sendError } from "../utils/response";

// GET /me/assignments — list all assignments for the current user across all projects
export async function listMyAssignments(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user!.userId;

        const assignments = await prisma.evaluationAssignment.findMany({
            where: { respondentUserId: userId },
            include: {
                target: { select: { id: true, name: true } },
                response: { select: { id: true, createdAt: true } },
                project: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        introText: true,
                        instrumentVersion: {
                            select: { id: true, scoringStrategy: true },
                        },
                    },
                },
            },
            orderBy: [{ projectId: "asc" }, { relationship: "asc" }],
        });

        sendSuccess(res, assignments);
    } catch (err) {
        next(err);
    }
}

// GET /assignments/:id/instrument — get instrument for a specific assignment
export async function getAssignmentInstrument(req: Request, res: Response, next: NextFunction) {
    try {
        const assignmentId = parseInt(req.params.id as string, 10);
        if (isNaN(assignmentId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }

        // requireAssignmentOwner middleware already verified ownership + existence
        const assignment = await prisma.evaluationAssignment.findUnique({
            where: { id: assignmentId },
            select: { projectId: true },
        });
        if (!assignment) { sendError(res, "Assignment not found", 404, "NOT_FOUND"); return; }

        const project = await prisma.project.findUnique({
            where: { id: assignment.projectId },
            include: {
                instrumentVersion: {
                    include: {
                        instrument: { select: { id: true, name: true } },
                        items: {
                            orderBy: { position: "asc" },
                            include: { construct: { select: { id: true, name: true } } },
                        },
                    },
                },
            },
        });
        if (!project) { sendError(res, "Project not found", 404, "NOT_FOUND"); return; }

        sendSuccess(res, {
            ...project.instrumentVersion,
            project: {
                id: project.id,
                name: project.name,
                introText: project.introText,
            },
        });
    } catch (err) {
        next(err);
    }
}
