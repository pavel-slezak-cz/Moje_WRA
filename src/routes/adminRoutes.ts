import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { requireAdmin, requireSuperuser, requireProjectAdminAccess } from "../middleware/adminGuard";
import { inspectorGuard } from "../middleware/inspectorGuard";
import * as admin from "../controllers/adminController";
import * as inspector from "../controllers/inspectorController";

export const adminRoutes = Router();

adminRoutes.use(authMiddleware);
adminRoutes.use(requireAdmin);

// ── Config ──
adminRoutes.get("/config", admin.getConfig);

// ── Instruments (catalog read: requireAdmin; write: SUPERUSER) ──
adminRoutes.get("/instruments", admin.listInstruments);
adminRoutes.post("/instruments", requireSuperuser, admin.createInstrument);
adminRoutes.patch("/instruments/:id", requireSuperuser, admin.updateInstrument);

// ── Versions (catalog read: requireAdmin; write: SUPERUSER) ──
adminRoutes.post("/instruments/:id/versions", requireSuperuser, admin.createVersion);
adminRoutes.get("/versions/:id", admin.getVersion);
adminRoutes.post("/versions/:id/clone", requireSuperuser, admin.cloneVersion);
adminRoutes.patch("/versions/:id", requireSuperuser, admin.updateVersion);

// ── Constructs (catalog read: requireAdmin; write: SUPERUSER) ──
adminRoutes.get("/constructs", admin.listConstructs);
adminRoutes.post("/constructs", requireSuperuser, admin.createConstruct);
adminRoutes.patch("/constructs/:id", requireSuperuser, admin.updateConstruct);

// ── Items (SUPERUSER only) ──
adminRoutes.post("/versions/:id/items", requireSuperuser, admin.createItem);
adminRoutes.patch("/items/:id", requireSuperuser, admin.updateItem);
adminRoutes.delete("/items/:id", requireSuperuser, admin.deleteItem);
adminRoutes.post("/versions/:id/items/reorder", requireSuperuser, admin.reorderItems);

// ── Projects (list scoped in controller; project-scoped: requireProjectAdminAccess) ──
adminRoutes.get("/projects", admin.listProjects);
adminRoutes.post("/projects", requireSuperuser, admin.createProject);
adminRoutes.get("/projects/:projectId", requireProjectAdminAccess, admin.getProject);
adminRoutes.patch("/projects/:projectId", requireProjectAdminAccess, admin.updateProject);
adminRoutes.delete("/projects/:projectId", requireSuperuser, admin.deleteProject);
adminRoutes.post("/projects/:projectId/participants", requireProjectAdminAccess, admin.addProjectParticipant);
adminRoutes.get("/projects/:projectId/instrument", requireProjectAdminAccess, admin.getProjectInstrument);

// ── Evaluation Assignments ──
adminRoutes.get("/projects/:projectId/assignments", requireProjectAdminAccess, admin.listAssignments);
adminRoutes.post("/projects/:projectId/assignments", requireProjectAdminAccess, admin.createAssignment);
adminRoutes.delete("/assignments/:id", admin.deleteAssignment);

// ── User Management (SUPERUSER only) ──
adminRoutes.get("/users", requireSuperuser, admin.listUsers);
adminRoutes.patch("/users/:id/role", requireSuperuser, admin.setUserRole);

// ── Project Staff Access (SUPERUSER only) ──
adminRoutes.get("/projects/:projectId/staff", requireSuperuser, admin.listProjectStaff);
adminRoutes.post("/projects/:projectId/staff", requireSuperuser, admin.grantProjectStaff);
adminRoutes.delete("/projects/:projectId/staff/:userId", requireSuperuser, admin.revokeProjectStaff);

// ── DB Inspector (gated) ──
adminRoutes.use("/inspector", inspectorGuard);
adminRoutes.get("/inspector/projects/:id/overview", inspector.projectOverview);
adminRoutes.get("/inspector/projects/:id/responses", inspector.listResponses);
adminRoutes.get("/inspector/responses/:id", inspector.responseDetail);
