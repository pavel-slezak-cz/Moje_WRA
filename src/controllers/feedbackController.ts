import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { submitResponseSchema, submitInstrumentResponseSchema } from "../middleware/validate";
import { sendSuccess, sendError } from "../utils/response";

// ── Legacy (questionnaire-based) ──

export async function submitResponse(req: Request, res: Response, next: NextFunction) {
    try {
        const questionnaireId = parseInt(req.params.id as string, 10);
        if (isNaN(questionnaireId)) {
            sendError(res, "Invalid questionnaire ID", 400, "INVALID_ID");
            return;
        }

        const data = submitResponseSchema.parse(req.body);

        const questionnaire = await prisma.questionnaire.findUnique({ where: { id: questionnaireId } });
        if (!questionnaire) {
            sendError(res, "Questionnaire not found", 404, "NOT_FOUND");
            return;
        }

        const response = await prisma.legacyResponse.create({
            data: {
                userId: req.user!.userId,
                questionnaireId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                answers: data.answers as any,
            },
        });

        sendSuccess(res, response, 201);
    } catch (err) {
        next(err);
    }
}

// ── Project-scoped (instrument-based, granular) ──

export async function submitProjectResponse(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = req.projectParticipant!.projectId;
        const data = submitInstrumentResponseSchema.parse(req.body);

        // Load project's instrument version + its items
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                instrumentVersion: { include: { items: { select: { id: true } } } },
            },
        });
        if (!project) {
            sendError(res, "Project not found", 404, "NOT_FOUND");
            return;
        }

        // Validate that all submitted itemIds belong to this version
        const validItemIds = new Set(project.instrumentVersion.items.map((i) => i.id));
        const invalidItems = data.items.filter((i) => !validItemIds.has(i.itemId));
        if (invalidItems.length > 0) {
            sendError(res, "Some item IDs do not belong to this instrument version", 400, "INVALID_ITEMS",
                { invalidItemIds: invalidItems.map((i) => i.itemId) });
            return;
        }

        // Create response + response items in a transaction
        const response = await prisma.$transaction(async (tx) => {
            const resp = await tx.instrumentResponse.create({
                data: {
                    userId: req.user!.userId,
                    instrumentVersionId: project.instrumentVersionId,
                    projectId,
                },
            });

            await tx.responseItem.createMany({
                data: data.items.map((i) => ({
                    responseId: resp.id,
                    itemId: i.itemId,
                    value: i.value,
                })),
            });

            return tx.instrumentResponse.findUnique({
                where: { id: resp.id },
                include: { items: true },
            });
        });

        sendSuccess(res, response, 201);
    } catch (err) {
        next(err);
    }
}

export async function getProjectResponses(req: Request, res: Response, next: NextFunction) {
    try {
        const { projectId, userId, role } = req.projectParticipant!;

        // OWNER/ADMIN see all responses; PARTICIPANT sees only own
        const whereClause = role === "PARTICIPANT"
            ? { projectId, userId }
            : { projectId };

        const responses = await prisma.instrumentResponse.findMany({
            where: whereClause,
            include: {
                user: { select: { id: true, name: true, email: true } },
                items: {
                    include: {
                        item: {
                            select: { id: true, text: true, position: true, construct: { select: { name: true } } },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        sendSuccess(res, responses);
    } catch (err) {
        next(err);
    }
}
