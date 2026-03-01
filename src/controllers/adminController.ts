import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { sendSuccess, sendError } from "../utils/response";
import { isInspectorAllowed } from "../middleware/inspectorGuard";
import {
    createInstrumentSchema,
    updateInstrumentSchema,
    createVersionSchema,
    updateVersionSchema,
    cloneVersionSchema,
    createConstructSchema,
    updateConstructSchema,
    createItemSchema,
    updateItemSchema,
    reorderItemsSchema,
    createProjectSchema,
    addParticipantByEmailSchema,
    createAssignmentSchema,
} from "../middleware/validate";

// ── Config ──

export async function getConfig(req: Request, res: Response, next: NextFunction) {
    try {
        const email = req.user!.email;
        sendSuccess(res, {
            inspectorEnabled: isInspectorAllowed(email),
        });
    } catch (err) {
        next(err);
    }
}

// ── Instruments ──

export async function listInstruments(_req: Request, res: Response, next: NextFunction) {
    try {
        const instruments = await prisma.instrument.findMany({
            include: {
                versions: {
                    select: { id: true, versionNumber: true, scoringStrategy: true, isActive: true, createdAt: true },
                    orderBy: { createdAt: "desc" },
                },
            },
            orderBy: { name: "asc" },
        });
        sendSuccess(res, instruments);
    } catch (err) {
        next(err);
    }
}

export async function createInstrument(req: Request, res: Response, next: NextFunction) {
    try {
        const data = createInstrumentSchema.parse(req.body);
        const instrument = await prisma.instrument.create({ data });
        sendSuccess(res, instrument, 201);
    } catch (err) {
        next(err);
    }
}

export async function updateInstrument(req: Request, res: Response, next: NextFunction) {
    try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        const data = updateInstrumentSchema.parse(req.body);
        const instrument = await prisma.instrument.update({ where: { id }, data });
        sendSuccess(res, instrument);
    } catch (err) {
        next(err);
    }
}

// ── Versions ──

export async function createVersion(req: Request, res: Response, next: NextFunction) {
    try {
        const instrumentId = parseInt(req.params.id as string, 10);
        if (isNaN(instrumentId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        const data = createVersionSchema.parse(req.body);
        const version = await prisma.instrumentVersion.create({
            data: {
                instrumentId,
                versionNumber: data.versionNumber,
                scoringStrategy: data.scoringStrategy,
                isActive: false,
            },
        });
        sendSuccess(res, version, 201);
    } catch (err) {
        next(err);
    }
}

export async function cloneVersion(req: Request, res: Response, next: NextFunction) {
    try {
        const sourceId = parseInt(req.params.id as string, 10);
        if (isNaN(sourceId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        const data = cloneVersionSchema.parse(req.body);

        const source = await prisma.instrumentVersion.findUnique({
            where: { id: sourceId },
            include: { items: true },
        });
        if (!source) { sendError(res, "Version not found", 404, "NOT_FOUND"); return; }

        const newVersion = await prisma.$transaction(async (tx) => {
            const ver = await tx.instrumentVersion.create({
                data: {
                    instrumentId: source.instrumentId,
                    versionNumber: data.versionNumber,
                    scoringStrategy: source.scoringStrategy,
                    isActive: false,
                },
            });

            if (source.items.length > 0) {
                await tx.item.createMany({
                    data: source.items.map((item) => ({
                        instrumentVersionId: ver.id,
                        constructId: item.constructId,
                        text: item.text,
                        scaleType: item.scaleType,
                        reverseScored: item.reverseScored,
                        measurementType: item.measurementType,
                        gapGroupId: item.gapGroupId,
                        behaviorPolarity: item.behaviorPolarity,
                        position: item.position,
                    })),
                });
            }

            return tx.instrumentVersion.findUnique({
                where: { id: ver.id },
                include: { items: { orderBy: { position: "asc" } } },
            });
        });

        sendSuccess(res, newVersion, 201);
    } catch (err) {
        next(err);
    }
}

export async function getVersion(req: Request, res: Response, next: NextFunction) {
    try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        const version = await prisma.instrumentVersion.findUnique({
            where: { id },
            include: {
                items: {
                    orderBy: { position: "asc" },
                    include: { construct: { select: { id: true, name: true } } },
                },
            },
        });
        if (!version) { sendError(res, "Version not found", 404, "NOT_FOUND"); return; }
        sendSuccess(res, version);
    } catch (err) {
        next(err);
    }
}

export async function updateVersion(req: Request, res: Response, next: NextFunction) {
    try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        const data = updateVersionSchema.parse(req.body);
        const version = await prisma.instrumentVersion.update({ where: { id }, data });
        sendSuccess(res, version);
    } catch (err) {
        next(err);
    }
}

// ── Constructs ──

export async function listConstructs(_req: Request, res: Response, next: NextFunction) {
    try {
        const constructs = await prisma.construct.findMany({ orderBy: { name: "asc" } });
        sendSuccess(res, constructs);
    } catch (err) {
        next(err);
    }
}

export async function createConstruct(req: Request, res: Response, next: NextFunction) {
    try {
        const data = createConstructSchema.parse(req.body);
        const construct = await prisma.construct.upsert({
            where: { name: data.name },
            update: {},
            create: data,
        });
        sendSuccess(res, construct, 201);
    } catch (err) {
        next(err);
    }
}

export async function updateConstruct(req: Request, res: Response, next: NextFunction) {
    try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        const data = updateConstructSchema.parse(req.body);
        const construct = await prisma.construct.update({ where: { id }, data });
        sendSuccess(res, construct);
    } catch (err) {
        next(err);
    }
}

// ── Items ──

export async function createItem(req: Request, res: Response, next: NextFunction) {
    try {
        const versionId = parseInt(req.params.id as string, 10);
        if (isNaN(versionId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        const data = createItemSchema.parse(req.body);

        // Determine next position
        const maxPos = await prisma.item.aggregate({
            where: { instrumentVersionId: versionId },
            _max: { position: true },
        });

        const item = await prisma.item.create({
            data: {
                instrumentVersionId: versionId,
                constructId: data.constructId,
                text: data.text,
                scaleType: data.scaleType ?? "LIKERT_5",
                labelSet: data.labelSet ?? null,
                reverseScored: data.reverseScored ?? false,
                behaviorPolarity: data.behaviorPolarity ?? null,
                position: (maxPos._max.position ?? 0) + 1,
            },
            include: { construct: { select: { id: true, name: true } } },
        });
        sendSuccess(res, item, 201);
    } catch (err) {
        next(err);
    }
}

export async function updateItem(req: Request, res: Response, next: NextFunction) {
    try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        const data = updateItemSchema.parse(req.body);
        const item = await prisma.item.update({
            where: { id },
            data,
            include: { construct: { select: { id: true, name: true } } },
        });
        sendSuccess(res, item);
    } catch (err) {
        next(err);
    }
}

export async function reorderItems(req: Request, res: Response, next: NextFunction) {
    try {
        const versionId = parseInt(req.params.id as string, 10);
        if (isNaN(versionId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        const { itemIds } = reorderItemsSchema.parse(req.body);

        await prisma.$transaction(
            itemIds.map((itemId, index) =>
                prisma.item.update({
                    where: { id: itemId },
                    data: { position: index + 1 },
                }),
            ),
        );

        const items = await prisma.item.findMany({
            where: { instrumentVersionId: versionId },
            orderBy: { position: "asc" },
            include: { construct: { select: { id: true, name: true } } },
        });
        sendSuccess(res, items);
    } catch (err) {
        next(err);
    }
}

// ── Projects ──

export async function listProjects(req: Request, res: Response, next: NextFunction) {
    try {
        const projects = await prisma.project.findMany({
            where: { ownerUserId: req.user!.userId },
            select: {
                id: true,
                name: true,
                description: true,
                createdAt: true,
                instrumentVersion: {
                    select: {
                        id: true,
                        versionNumber: true,
                        scoringStrategy: true,
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

export async function createProject(req: Request, res: Response, next: NextFunction) {
    try {
        const data = createProjectSchema.parse(req.body);
        const version = await prisma.instrumentVersion.findUnique({ where: { id: data.instrumentVersionId } });
        if (!version) { sendError(res, "Instrument version not found", 404, "NOT_FOUND"); return; }

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
                data: { projectId: proj.id, userId: req.user!.userId, role: "OWNER" },
            });
            return proj;
        });
        sendSuccess(res, project, 201);
    } catch (err) {
        next(err);
    }
}

export async function getProject(req: Request, res: Response, next: NextFunction) {
    try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }

        const project = await prisma.project.findUnique({
            where: { id },
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
                        joinedAt: true,
                        user: { select: { id: true, email: true, name: true } },
                    },
                },
                _count: { select: { responses: true } },
            },
        });
        if (!project) { sendError(res, "Project not found", 404, "NOT_FOUND"); return; }
        if (project.ownerUserId !== req.user!.userId) {
            sendError(res, "Not project owner", 403, "INSUFFICIENT_ROLE"); return;
        }
        sendSuccess(res, project);
    } catch (err) {
        next(err);
    }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction) {
    try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }

        const project = await prisma.project.findUnique({ where: { id } });
        if (!project) { sendError(res, "Project not found", 404, "NOT_FOUND"); return; }
        if (project.ownerUserId !== req.user!.userId) {
            sendError(res, "Not project owner", 403, "INSUFFICIENT_ROLE"); return;
        }

        await prisma.$transaction(async (tx) => {
            // Collect response IDs for this project
            const responses = await tx.instrumentResponse.findMany({
                where: { projectId: id },
                select: { id: true },
            });
            const responseIds = responses.map((r) => r.id);

            if (responseIds.length > 0) {
                // Delete scores in dependency order
                await tx.globalScore.deleteMany({ where: { responseId: { in: responseIds } } });
                await tx.constructScore.deleteMany({ where: { responseId: { in: responseIds } } });
                await tx.itemScore.deleteMany({ where: { responseId: { in: responseIds } } });
                // ResponseItems cascade from InstrumentResponse deletion
            }

            await tx.instrumentResponse.deleteMany({ where: { projectId: id } });
            await tx.evaluationAssignment.deleteMany({ where: { projectId: id } });
            await tx.projectParticipant.deleteMany({ where: { projectId: id } });
            await tx.project.delete({ where: { id } });
        });

        sendSuccess(res, { deleted: true });
    } catch (err) {
        next(err);
    }
}

export async function deleteItem(req: Request, res: Response, next: NextFunction) {
    try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }

        const item = await prisma.item.findUnique({ where: { id } });
        if (!item) { sendError(res, "Item not found", 404, "NOT_FOUND"); return; }

        // Refuse if the item has any responses
        const responseCount = await prisma.responseItem.count({ where: { itemId: id } });
        if (responseCount > 0) {
            sendError(res, "This item has responses and cannot be deleted. Delete the project first.", 409, "HAS_RESPONSES");
            return;
        }

        await prisma.item.delete({ where: { id } });
        sendSuccess(res, { deleted: true });
    } catch (err) {
        next(err);
    }
}

// ── Evaluation Assignments ──

export async function listAssignments(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = parseInt(req.params.id as string, 10);
        if (isNaN(projectId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) { sendError(res, "Project not found", 404, "NOT_FOUND"); return; }
        if (project.ownerUserId !== req.user!.userId) {
            sendError(res, "Not project owner", 403, "INSUFFICIENT_ROLE"); return;
        }

        const assignments = await prisma.evaluationAssignment.findMany({
            where: { projectId },
            include: {
                evaluator: { select: { id: true, email: true, name: true } },
                target: { select: { id: true, email: true, name: true } },
                response: { select: { id: true, createdAt: true } },
            },
            orderBy: [{ targetUserId: "asc" }, { relationship: "asc" }],
        });
        sendSuccess(res, assignments);
    } catch (err) {
        next(err);
    }
}

export async function createAssignment(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = parseInt(req.params.id as string, 10);
        if (isNaN(projectId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        const data = createAssignmentSchema.parse(req.body);

        // Verify ownership
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) { sendError(res, "Project not found", 404, "NOT_FOUND"); return; }
        if (project.ownerUserId !== req.user!.userId) {
            sendError(res, "Not project owner", 403, "INSUFFICIENT_ROLE"); return;
        }

        // SELF constraint: evaluator must equal target
        if (data.relationship === "SELF" && data.evaluatorUserId !== data.targetUserId) {
            sendError(res, "SELF assignments require evaluator and target to be the same user", 400, "INVALID_SELF_ASSIGNMENT");
            return;
        }

        // Both users must be project participants
        const evaluatorParticipant = await prisma.projectParticipant.findUnique({
            where: { projectId_userId: { projectId, userId: data.evaluatorUserId } },
        });
        if (!evaluatorParticipant) {
            sendError(res, "Evaluator is not a participant in this project", 400, "NOT_PARTICIPANT");
            return;
        }
        const targetParticipant = await prisma.projectParticipant.findUnique({
            where: { projectId_userId: { projectId, userId: data.targetUserId } },
        });
        if (!targetParticipant) {
            sendError(res, "Target is not a participant in this project", 400, "NOT_PARTICIPANT");
            return;
        }

        const assignment = await prisma.evaluationAssignment.create({
            data: {
                projectId,
                evaluatorUserId: data.evaluatorUserId,
                targetUserId: data.targetUserId,
                relationship: data.relationship,
            },
            include: {
                evaluator: { select: { id: true, email: true, name: true } },
                target: { select: { id: true, email: true, name: true } },
            },
        });
        sendSuccess(res, assignment, 201);
    } catch (err) {
        next(err);
    }
}

export async function deleteAssignment(req: Request, res: Response, next: NextFunction) {
    try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }

        const assignment = await prisma.evaluationAssignment.findUnique({
            where: { id },
            include: { project: { select: { ownerUserId: true } }, response: { select: { id: true } } },
        });
        if (!assignment) { sendError(res, "Assignment not found", 404, "NOT_FOUND"); return; }
        if (assignment.project.ownerUserId !== req.user!.userId) {
            sendError(res, "Not project owner", 403, "INSUFFICIENT_ROLE"); return;
        }
        if (assignment.response) {
            sendError(res, "This assignment has a completed response and cannot be deleted", 409, "HAS_RESPONSE");
            return;
        }

        await prisma.evaluationAssignment.delete({ where: { id } });
        sendSuccess(res, { deleted: true });
    } catch (err) {
        next(err);
    }
}

export async function addProjectParticipant(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = parseInt(req.params.id as string, 10);
        if (isNaN(projectId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        const data = addParticipantByEmailSchema.parse(req.body);

        // Verify ownership
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) { sendError(res, "Project not found", 404, "NOT_FOUND"); return; }
        if (project.ownerUserId !== req.user!.userId) {
            sendError(res, "Not project owner", 403, "INSUFFICIENT_ROLE"); return;
        }

        // Find user by email
        const user = await prisma.user.findUnique({ where: { email: data.email } });
        if (!user) { sendError(res, "User not found", 404, "USER_NOT_FOUND"); return; }

        const participant = await prisma.projectParticipant.create({
            data: {
                projectId,
                userId: user.id,
                role: data.role || "PARTICIPANT",
            },
            include: { user: { select: { id: true, email: true, name: true } } },
        });
        sendSuccess(res, participant, 201);
    } catch (err) {
        next(err);
    }
}
