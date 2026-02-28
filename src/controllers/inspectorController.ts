import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { sendSuccess, sendError } from "../utils/response";

// ── Helper: verify project ownership ──

async function verifyOwnership(req: Request, res: Response, projectId: number): Promise<boolean> {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
        sendError(res, "Endpoint not found", 404, "NOT_FOUND");
        return false;
    }
    if (project.ownerUserId !== req.user!.userId) {
        sendError(res, "Endpoint not found", 404, "NOT_FOUND");
        return false;
    }
    return true;
}

// ── Project overview ──

export async function projectOverview(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = parseInt(req.params.id as string, 10);
        if (isNaN(projectId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        if (!(await verifyOwnership(req, res, projectId))) return;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                instrumentVersion: {
                    select: {
                        id: true,
                        versionNumber: true,
                        scoringStrategy: true,
                        instrument: { select: { id: true, name: true } },
                    },
                },
                participants: {
                    select: {
                        id: true,
                        role: true,
                        user: { select: { id: true, email: true, name: true } },
                    },
                },
            },
        });

        const counts = {
            responses: await prisma.instrumentResponse.count({ where: { projectId } }),
            responseItems: await prisma.responseItem.count({
                where: { response: { projectId } },
            }),
            itemScores: await prisma.itemScore.count({
                where: { response: { projectId } },
            }),
            constructScores: await prisma.constructScore.count({
                where: { response: { projectId } },
            }),
        };

        sendSuccess(res, { project, counts });
    } catch (err) {
        next(err);
    }
}

// ── List responses ──

export async function listResponses(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = parseInt(req.params.id as string, 10);
        if (isNaN(projectId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        if (!(await verifyOwnership(req, res, projectId))) return;

        const responses = await prisma.instrumentResponse.findMany({
            where: { projectId },
            select: {
                id: true,
                createdAt: true,
                user: { select: { id: true, email: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        // Add stable respondent labels
        const data = responses.map((r, index) => ({
            responseId: r.id,
            createdAt: r.createdAt,
            respondent: {
                userId: r.user.id,
                email: r.user.email,
                name: r.user.name,
                label: `Respondent #${index + 1}`,
            },
        }));

        sendSuccess(res, data);
    } catch (err) {
        next(err);
    }
}

// ── Response detail ──

export async function responseDetail(req: Request, res: Response, next: NextFunction) {
    try {
        const responseId = parseInt(req.params.id as string, 10);
        if (isNaN(responseId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }

        const response = await prisma.instrumentResponse.findUnique({
            where: { id: responseId },
            include: {
                items: {
                    include: {
                        item: {
                            select: {
                                id: true,
                                text: true,
                                position: true,
                                scaleType: true,
                                reverseScored: true,
                                behaviorPolarity: true,
                                construct: { select: { id: true, name: true } },
                            },
                        },
                    },
                    orderBy: { item: { position: "asc" } },
                },
                itemScores: {
                    include: {
                        item: {
                            select: {
                                id: true,
                                text: true,
                                position: true,
                                construct: { select: { name: true } },
                            },
                        },
                    },
                    orderBy: { item: { position: "asc" } },
                },
                constructScores: {
                    include: { construct: { select: { id: true, name: true } } },
                },
                globalScore: true,
                user: { select: { id: true, email: true, name: true } },
            },
        });

        if (!response) { sendError(res, "Endpoint not found", 404, "NOT_FOUND"); return; }

        // Verify ownership via project
        if (!(await verifyOwnership(req, res, response.projectId))) return;

        sendSuccess(res, {
            responseId: response.id,
            projectId: response.projectId,
            createdAt: response.createdAt,
            respondent: {
                userId: response.user.id,
                email: response.user.email,
                name: response.user.name,
            },
            responseItems: response.items.map((ri) => ({
                itemId: ri.itemId,
                channel: ri.channel,
                value: ri.value,
                text: ri.item.text,
                position: ri.item.position,
                construct: ri.item.construct.name,
            })),
            itemScores: response.itemScores.map((is) => ({
                itemId: is.itemId,
                text: is.item.text,
                construct: is.item.construct.name,
                sourceValue: is.sourceValue,
                targetValue: is.targetValue,
                gapValue: is.gapValue,
                absoluteGapValue: is.absoluteGapValue,
            })),
            constructScores: response.constructScores.map((cs) => ({
                construct: cs.construct.name,
                sourceMean: cs.sourceMean,
                targetMean: cs.targetMean,
                gapMean: cs.gapMean,
                meanAbsoluteGap: cs.meanAbsoluteGap,
            })),
            globalScore: response.globalScore ? {
                globalSourceMean: response.globalScore.globalSourceMean,
                globalTargetMean: response.globalScore.globalTargetMean,
                globalGapMean: response.globalScore.globalGapMean,
                globalMeanAbsoluteGap: response.globalScore.globalMeanAbsoluteGap,
                scoringModelVersion: response.globalScore.scoringModelVersion,
            } : null,
        });
    } catch (err) {
        next(err);
    }
}
