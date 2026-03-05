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
        const assignmentId = data.assignmentId ?? null;

        // Validate assignmentId if provided
        if (assignmentId) {
            const assignment = await prisma.evaluationAssignment.findUnique({
                where: { id: assignmentId },
                include: { response: { select: { id: true } } },
            });
            if (!assignment) {
                sendError(res, "Assignment not found", 404, "NOT_FOUND");
                return;
            }
            if (assignment.projectId !== projectId) {
                sendError(res, "Assignment does not belong to this project", 400, "INVALID_ASSIGNMENT");
                return;
            }
            if (assignment.respondentUserId !== req.user!.userId) {
                sendError(res, "This assignment is not assigned to you", 403, "NOT_ASSIGNED");
                return;
            }
            if (assignment.response) {
                sendError(res, "This assignment already has a completed response", 409, "ALREADY_COMPLETED");
                return;
            }
        }

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
        const expectedItemIds = new Set(project.instrumentVersion.items.map((i) => i.id));

        // Reject unknown itemIds
        const unknownIds = rows.filter((r) => !expectedItemIds.has(r.itemId)).map((r) => r.itemId);
        if (unknownIds.length > 0) {
            sendError(res, "Some item IDs do not belong to this instrument version", 400, "INVALID_ITEMS",
                { invalidItemIds: [...new Set(unknownIds)] });
            return;
        }

        // Build per-item channel sets and detect duplicates
        const byItem = new Map<number, { SOURCE: number; TARGET: number }>();
        for (const r of rows) {
            const counts = byItem.get(r.itemId) ?? { SOURCE: 0, TARGET: 0 };
            counts[r.channel]++;
            byItem.set(r.itemId, counts);
        }

        const duplicateIds = [...byItem.entries()]
            .filter(([, c]) => c.SOURCE > 1 || c.TARGET > 1)
            .map(([id]) => id);
        if (duplicateIds.length > 0) {
            sendError(res, "Duplicate channel rows for the same item", 400, "DUPLICATE_CHANNEL",
                { itemIds: duplicateIds });
            return;
        }

        // Strategy-specific completeness validation
        if (strategy === "WRA_ABSOLUTE_GAP") {
            const missingIds: number[] = [];
            const incompleteIds: number[] = [];
            for (const itemId of expectedItemIds) {
                const counts = byItem.get(itemId);
                if (!counts) {
                    missingIds.push(itemId);
                } else if (counts.SOURCE !== 1 || counts.TARGET !== 1) {
                    incompleteIds.push(itemId);
                }
            }
            if (missingIds.length > 0 || incompleteIds.length > 0) {
                sendError(res, "Incomplete submission", 400, "INCOMPLETE_SUBMISSION",
                    { missing: { itemIds: missingIds }, invalid: { itemIds: incompleteIds } });
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
            // All items must have exactly one SOURCE
            const missingIds: number[] = [];
            for (const itemId of expectedItemIds) {
                const counts = byItem.get(itemId);
                if (!counts || counts.SOURCE !== 1) {
                    missingIds.push(itemId);
                }
            }
            if (missingIds.length > 0) {
                sendError(res, "Incomplete submission", 400, "INCOMPLETE_SUBMISSION",
                    { missing: { itemIds: missingIds }, invalid: { itemIds: [] } });
                return;
            }
        }

        // Create response + response items + scores in a transaction
        let response;
        try {
            response = await prisma.$transaction(async (tx) => {
                const resp = await tx.instrumentResponse.create({
                    data: {
                        userId: req.user!.userId,
                        instrumentVersionId: project.instrumentVersionId,
                        projectId,
                        assignmentId,
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
        } catch (err) {
            // Scoring guard errors indicate internal inconsistency
            if (err instanceof Error && err.message.startsWith("Scoring error:")) {
                sendError(res, err.message, 500, "SERVER_ERROR");
                return;
            }
            throw err;
        }

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
