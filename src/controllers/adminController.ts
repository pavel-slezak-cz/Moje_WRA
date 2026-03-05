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
    updateProjectSchema,
    addParticipantByEmailSchema,
    createAssignmentSchema,
    setUserRoleSchema,
    grantStaffAccessSchema,
} from "../middleware/validate";
import { hashPassword } from "../utils/hash";

// ── Config ──

export async function getConfig(req: Request, res: Response, next: NextFunction) {
    try {
        const email = req.user!.email;
        sendSuccess(res, {
            role: req.user!.role,
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
        const where = req.user!.role === "SUPERUSER"
            ? {}
            : { staffAccess: { some: { userId: req.user!.userId } } };

        const projects = await prisma.project.findMany({
            where,
            select: {
                id: true,
                name: true,
                description: true,
                introText: true,
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
                    introText: data.introText,
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
        const id = parseInt(req.params.projectId as string, 10);
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
        sendSuccess(res, project);
    } catch (err) {
        next(err);
    }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
    try {
        const id = parseInt(req.params.projectId as string, 10);
        if (isNaN(id)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }

        const data = updateProjectSchema.parse(req.body);
        const project = await prisma.project.findUnique({ where: { id } });
        if (!project) { sendError(res, "Project not found", 404, "NOT_FOUND"); return; }

        const updated = await prisma.project.update({ where: { id }, data });
        sendSuccess(res, updated);
    } catch (err) {
        next(err);
    }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction) {
    try {
        const id = parseInt(req.params.projectId as string, 10);
        if (isNaN(id)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }

        const project = await prisma.project.findUnique({ where: { id } });
        if (!project) { sendError(res, "Project not found", 404, "NOT_FOUND"); return; }

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
        const projectId = parseInt(req.params.projectId as string, 10);
        if (isNaN(projectId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) { sendError(res, "Project not found", 404, "NOT_FOUND"); return; }

        const assignments = await prisma.evaluationAssignment.findMany({
            where: { projectId },
            include: {
                respondent: { select: { id: true, email: true, name: true } },
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
        const projectId = parseInt(req.params.projectId as string, 10);
        if (isNaN(projectId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        const data = createAssignmentSchema.parse(req.body);

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) { sendError(res, "Project not found", 404, "NOT_FOUND"); return; }

        // SELF constraint: respondent must equal target
        if (data.relationship === "SELF" && data.respondentUserId !== data.targetUserId) {
            sendError(res, "SELF assignments require respondent and target to be the same user", 400, "INVALID_SELF_ASSIGNMENT");
            return;
        }

        // Both users must be project participants
        const respondentParticipant = await prisma.projectParticipant.findUnique({
            where: { projectId_userId: { projectId, userId: data.respondentUserId } },
        });
        if (!respondentParticipant) {
            sendError(res, "Respondent is not a participant in this project", 400, "NOT_PARTICIPANT");
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
                respondentUserId: data.respondentUserId,
                targetUserId: data.targetUserId,
                relationship: data.relationship,
            },
            include: {
                respondent: { select: { id: true, email: true, name: true } },
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
            include: { response: { select: { id: true } } },
        });
        if (!assignment) { sendError(res, "Assignment not found", 404, "NOT_FOUND"); return; }

        // STAFF must have project access (SUPERUSER passes via requireAdmin)
        if (req.user!.role === "STAFF") {
            const access = await prisma.projectStaffAccess.findUnique({
                where: { userId_projectId: { userId: req.user!.userId, projectId: assignment.projectId } },
                select: { id: true },
            });
            if (!access) {
                sendError(res, "No admin access to this project", 403, "PROJECT_ADMIN_ACCESS_DENIED");
                return;
            }
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
        const projectId = parseInt(req.params.projectId as string, 10);
        if (isNaN(projectId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        const parsed = addParticipantByEmailSchema.safeParse(req.body);
        if (!parsed.success) {
            const fields = parsed.error.flatten().fieldErrors;
            const msgs = Object.entries(fields).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join("; ");
            sendError(res, msgs || "Invalid input", 400, "VALIDATION_ERROR", fields);
            return;
        }
        const data = parsed.data;

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) { sendError(res, "Project not found", 404, "NOT_FOUND"); return; }

        // Find or create user by email
        let user = await prisma.user.findUnique({ where: { email: data.email } });
        if (!user) {
            if (!data.name || !data.password) {
                sendError(res, "User not found. Provide name and password to create a new account.", 404, "USER_NOT_FOUND");
                return;
            }
            const passwordHash = await hashPassword(data.password);
            user = await prisma.user.create({
                data: { email: data.email, name: data.name, passwordHash },
            });
        }

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

// ── User Management (SUPERUSER only) ──

export async function listUsers(_req: Request, res: Response, next: NextFunction) {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, email: true, name: true, role: true, createdAt: true },
            orderBy: { email: "asc" },
        });
        sendSuccess(res, users);
    } catch (err) {
        next(err);
    }
}

export async function setUserRole(req: Request, res: Response, next: NextFunction) {
    try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        const data = setUserRoleSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) { sendError(res, "User not found", 404, "NOT_FOUND"); return; }

        // Prevent demoting yourself
        if (id === req.user!.userId && data.role !== "SUPERUSER") {
            sendError(res, "Cannot change your own role away from SUPERUSER", 400, "SELF_DEMOTION");
            return;
        }

        const updated = await prisma.user.update({
            where: { id },
            data: { role: data.role },
            select: { id: true, email: true, name: true, role: true },
        });
        sendSuccess(res, updated);
    } catch (err) {
        next(err);
    }
}

// ── Project Staff Access (SUPERUSER only) ──

export async function listProjectStaff(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = parseInt(req.params.projectId as string, 10);
        if (isNaN(projectId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }

        const staffAccess = await prisma.projectStaffAccess.findMany({
            where: { projectId },
            include: { user: { select: { id: true, email: true, name: true, role: true } } },
            orderBy: { createdAt: "asc" },
        });
        sendSuccess(res, staffAccess);
    } catch (err) {
        next(err);
    }
}

export async function grantProjectStaff(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = parseInt(req.params.projectId as string, 10);
        if (isNaN(projectId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }
        const data = grantStaffAccessSchema.parse(req.body);

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) { sendError(res, "Project not found", 404, "NOT_FOUND"); return; }

        const user = await prisma.user.findUnique({ where: { id: data.userId } });
        if (!user) { sendError(res, "User not found", 404, "NOT_FOUND"); return; }
        if (user.role !== "STAFF") {
            sendError(res, "User must have STAFF role to be granted project access", 400, "NOT_STAFF_ROLE");
            return;
        }

        const access = await prisma.projectStaffAccess.create({
            data: { userId: data.userId, projectId },
            include: { user: { select: { id: true, email: true, name: true } } },
        });
        sendSuccess(res, access, 201);
    } catch (err) {
        next(err);
    }
}

export async function revokeProjectStaff(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = parseInt(req.params.projectId as string, 10);
        const userId = parseInt(req.params.userId as string, 10);
        if (isNaN(projectId) || isNaN(userId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }

        const access = await prisma.projectStaffAccess.findUnique({
            where: { userId_projectId: { userId, projectId } },
        });
        if (!access) { sendError(res, "Staff access not found", 404, "NOT_FOUND"); return; }

        await prisma.projectStaffAccess.delete({
            where: { userId_projectId: { userId, projectId } },
        });
        sendSuccess(res, { deleted: true });
    } catch (err) {
        next(err);
    }
}

// ── Project Instrument (admin view) ──

export async function getProjectInstrument(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = parseInt(req.params.projectId as string, 10);
        if (isNaN(projectId)) { sendError(res, "Invalid ID", 400, "INVALID_ID"); return; }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
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

        sendSuccess(res, project.instrumentVersion);
    } catch (err) {
        next(err);
    }
}
