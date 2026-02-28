import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { inspectorGuard } from "../middleware/inspectorGuard";
import * as admin from "../controllers/adminController";
import * as inspector from "../controllers/inspectorController";

export const adminRoutes = Router();

adminRoutes.use(authMiddleware);

// ── Config ──
adminRoutes.get("/config", admin.getConfig);

// ── Instruments ──
adminRoutes.get("/instruments", admin.listInstruments);
adminRoutes.post("/instruments", admin.createInstrument);
adminRoutes.patch("/instruments/:id", admin.updateInstrument);

// ── Versions ──
adminRoutes.post("/instruments/:id/versions", admin.createVersion);
adminRoutes.post("/versions/:id/clone", admin.cloneVersion);
adminRoutes.patch("/versions/:id", admin.updateVersion);

// ── Constructs ──
adminRoutes.post("/constructs", admin.createConstruct);
adminRoutes.patch("/constructs/:id", admin.updateConstruct);

// ── Items ──
adminRoutes.post("/versions/:id/items", admin.createItem);
adminRoutes.patch("/items/:id", admin.updateItem);
adminRoutes.post("/versions/:id/items/reorder", admin.reorderItems);

// ── Projects ──
adminRoutes.get("/projects", admin.listProjects);
adminRoutes.post("/projects", admin.createProject);
adminRoutes.get("/projects/:id", admin.getProject);
adminRoutes.post("/projects/:id/participants", admin.addProjectParticipant);

// ── DB Inspector (gated) ──
adminRoutes.use("/inspector", inspectorGuard);
adminRoutes.get("/inspector/projects/:id/overview", inspector.projectOverview);
adminRoutes.get("/inspector/projects/:id/responses", inspector.listResponses);
adminRoutes.get("/inspector/responses/:id", inspector.responseDetail);
