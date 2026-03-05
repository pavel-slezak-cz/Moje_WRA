import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { requireOwner } from "../middleware/adminGuard";
import { inspectorGuard } from "../middleware/inspectorGuard";
import * as admin from "../controllers/adminController";
import * as inspector from "../controllers/inspectorController";

export const adminRoutes = Router();

adminRoutes.use(authMiddleware);
adminRoutes.use(requireOwner);

// ── Config ──
adminRoutes.get("/config", admin.getConfig);

// ── Instruments ──
adminRoutes.get("/instruments", admin.listInstruments);
adminRoutes.post("/instruments", admin.createInstrument);
adminRoutes.patch("/instruments/:id", admin.updateInstrument);

// ── Versions ──
adminRoutes.post("/instruments/:id/versions", admin.createVersion);
adminRoutes.get("/versions/:id", admin.getVersion);
adminRoutes.post("/versions/:id/clone", admin.cloneVersion);
adminRoutes.patch("/versions/:id", admin.updateVersion);

// ── Constructs ──
adminRoutes.get("/constructs", admin.listConstructs);
adminRoutes.post("/constructs", admin.createConstruct);
adminRoutes.patch("/constructs/:id", admin.updateConstruct);

// ── Items ──
adminRoutes.post("/versions/:id/items", admin.createItem);
adminRoutes.patch("/items/:id", admin.updateItem);
adminRoutes.delete("/items/:id", admin.deleteItem);
adminRoutes.post("/versions/:id/items/reorder", admin.reorderItems);

// ── Projects ──
adminRoutes.get("/projects", admin.listProjects);
adminRoutes.post("/projects", admin.createProject);
adminRoutes.get("/projects/:id", admin.getProject);
adminRoutes.patch("/projects/:id", admin.updateProject);
adminRoutes.delete("/projects/:id", admin.deleteProject);
adminRoutes.post("/projects/:id/participants", admin.addProjectParticipant);

// ── Evaluation Assignments ──
adminRoutes.get("/projects/:id/assignments", admin.listAssignments);
adminRoutes.post("/projects/:id/assignments", admin.createAssignment);
adminRoutes.delete("/assignments/:id", admin.deleteAssignment);

// ── DB Inspector (gated) ──
adminRoutes.use("/inspector", inspectorGuard);
adminRoutes.get("/inspector/projects/:id/overview", inspector.projectOverview);
adminRoutes.get("/inspector/projects/:id/responses", inspector.listResponses);
adminRoutes.get("/inspector/responses/:id", inspector.responseDetail);
