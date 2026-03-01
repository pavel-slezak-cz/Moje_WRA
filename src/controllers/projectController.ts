import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { sendSuccess, sendError } from "../utils/response";
import { createProjectSchema, addParticipantSchema } from "../middleware/validate";

export async function create(req: Request, res: Response, next: NextFunction) {
    try {
        const data = createProjectSchema.parse(req.body);

        // Verify instrument version exists
        const version = await prisma.instrumentVersion.findUnique({
            where: { id: data.instrumentVersionId },
        });
        if (!version) {
            sendError(res, "Instrument version not found", 404, "NOT_FOUND");
            return;
        }

        // Create project + add caller as OWNER in a transaction
        const project = await prisma.$transaction(async (tx) => {
            const proj = await tx.project.create({
                data: {
                    name: data.name,
                    description: data.description,
                    ownerUserId: req.user!.userId,
                    instrumentVersionId: data.instrumentVersionId,
                },
            });

            await tx.projectParticipant.create({
                data: {
                    projectId: proj.id,
                    userId: req.user!.userId,
                    role: "OWNER",
                },
            });

            return proj;
        });

        sendSuccess(res, project, 201);
    } catch (err) {
        next(err);
    }
}

export async function list(req: Request, res: Response, next: NextFunction) {
    try {
        const projects = await prisma.project.findMany({
            where: {
                participants: { some: { userId: req.user!.userId } },
            },
            select: {
                id: true,
                name: true,
                description: true,
                createdAt: true,
                instrumentVersion: {
                    select: {
                        id: true,
                        versionNumber: true,
                        instrument: { select: { id: true, name: true } },
                    },
                },
                _count: { select: { participants: true, responses: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        sendSuccess(res, projects);
    } catch (err) {
        next(err);
    }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = req.projectParticipant!.projectId;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                instrumentVersion: {
                    select: {
                        id: true,
                        versionNumber: true,
                        instrument: { select: { id: true, name: true } },
                    },
                },
                participants: {
                    select: {
                        id: true,
                        role: true,
                        joinedAt: true,
                        user: { select: { id: true, email: true, name: true } },
                    },
                },
                _count: { select: { responses: true } },
            },
        });

        sendSuccess(res, project);
    } catch (err) {
        next(err);
    }
}

export async function myAssignments(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = req.projectParticipant!.projectId;
        const userId = req.user!.userId;

        const assignments = await prisma.evaluationAssignment.findMany({
            where: { projectId, evaluatorUserId: userId },
            include: {
                target: { select: { id: true, name: true, email: true } },
                response: { select: { id: true, createdAt: true } },
            },
            orderBy: { relationship: "asc" },
        });
        sendSuccess(res, assignments);
    } catch (err) {
        next(err);
    }
}

export async function addParticipant(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = req.projectParticipant!.projectId;
        const data = addParticipantSchema.parse(req.body);

        // Verify target user exists
        const user = await prisma.user.findUnique({ where: { id: data.userId } });
        if (!user) {
            sendError(res, "User not found", 404, "NOT_FOUND");
            return;
        }

        const participant = await prisma.projectParticipant.create({
            data: {
                projectId,
                userId: data.userId,
                role: data.role || "PARTICIPANT",
            },
            include: {
                user: { select: { id: true, email: true, name: true } },
            },
        });

        sendSuccess(res, participant, 201);
    } catch (err) {
        next(err);
    }
}
