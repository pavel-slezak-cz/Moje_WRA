import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { submitResponseSchema, submitInstrumentResponseSchema, NormalizedRow } from "../middleware/validate";
import { sendSuccess, sendError } from "../utils/response";
import { scoreResponse } from "../services/scoringService";

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
        const rows: NormalizedRow[] = data.rows;

        // Load project's instrument version + its items (with scoring metadata)
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                instrumentVersion: {
                    include: {
                        items: {
                            select: {
                                id: true,
                                constructId: true,
                                scaleType: true,
                                reverseScored: true,
                                measurementType: true,
                                gapGroupId: true,
                                behaviorPolarity: true,
                            },
                        },
                    },
                },
            },
        });
        if (!project) {
            sendError(res, "Project not found", 404, "NOT_FOUND");
            return;
        }

        const strategy = project.instrumentVersion.scoringStrategy;
        const validItemIds = new Set(project.instrumentVersion.items.map((i) => i.id));

        // Validate that all submitted itemIds belong to this version
        const invalidIds = rows.filter((r) => !validItemIds.has(r.itemId)).map((r) => r.itemId);
        if (invalidIds.length > 0) {
            sendError(res, "Some item IDs do not belong to this instrument version", 400, "INVALID_ITEMS",
                { invalidItemIds: [...new Set(invalidIds)] });
            return;
        }

        // Strategy-specific validation
        if (strategy === "WRA_ABSOLUTE_GAP") {
            // Every item must have both SOURCE and TARGET
            const byItem = new Map<number, Set<string>>();
            for (const r of rows) {
                const set = byItem.get(r.itemId) ?? new Set();
                set.add(r.channel);
                byItem.set(r.itemId, set);
            }
            const missing = [...byItem.entries()].filter(([, ch]) => !ch.has("SOURCE") || !ch.has("TARGET"));
            if (missing.length > 0) {
                sendError(res, "WRA requires both SOURCE and TARGET for each item", 400, "MISSING_CHANNEL",
                    { itemIds: missing.map(([id]) => id) });
                return;
            }
        } else if (strategy === "NORMATIVE_360") {
            // Reject TARGET rows
            const targetRows = rows.filter((r) => r.channel === "TARGET");
            if (targetRows.length > 0) {
                sendError(res, "360 instruments do not accept TARGET responses", 400, "INVALID_CHANNEL",
                    { itemIds: targetRows.map((r) => r.itemId) });
                return;
            }
        }

        // Create response + response items + scores in a transaction
        const response = await prisma.$transaction(async (tx) => {
            const resp = await tx.instrumentResponse.create({
                data: {
                    userId: req.user!.userId,
                    instrumentVersionId: project.instrumentVersionId,
                    projectId,
                },
            });

            await tx.responseItem.createMany({
                data: rows.map((r) => ({
                    responseId: resp.id,
                    itemId: r.itemId,
                    channel: r.channel,
                    value: r.value,
                })),
            });

            // Score the response
            await scoreResponse(
                tx,
                resp.id,
                strategy,
                project.instrumentVersion.items,
                rows,
            );

            return tx.instrumentResponse.findUnique({
                where: { id: resp.id },
                include: {
                    items: true,
                    itemScores: true,
                    constructScores: { include: { construct: { select: { name: true } } } },
                    globalScore: true,
                },
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
                constructScores: { include: { construct: { select: { name: true } } } },
                globalScore: true,
            },
            orderBy: { createdAt: "desc" },
        });

        sendSuccess(res, responses);
    } catch (err) {
        next(err);
    }
}
