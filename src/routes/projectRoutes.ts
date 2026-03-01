import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { requireProjectRole } from "../middleware/projectAuth";
import { create, list, getById, addParticipant, myAssignments } from "../controllers/projectController";
import { submitProjectResponse, getProjectResponses } from "../controllers/feedbackController";

export const projectRoutes = Router();

projectRoutes.use(authMiddleware);

// Project management
projectRoutes.post("/", create);
projectRoutes.get("/", list);
projectRoutes.get("/:id", requireProjectRole(), getById);
projectRoutes.post("/:id/participants", requireProjectRole("OWNER", "ADMIN"), addParticipant);

// Project-scoped assignments
projectRoutes.get("/:id/assignments", requireProjectRole(), myAssignments);

// Project-scoped responses
projectRoutes.post("/:id/responses", requireProjectRole(), submitProjectResponse);
projectRoutes.get("/:id/responses", requireProjectRole(), getProjectResponses);
