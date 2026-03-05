import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { requireProjectRole } from "../middleware/projectAuth";
import { submitProjectResponse, getProjectResponses } from "../controllers/feedbackController";

export const projectRoutes = Router();

projectRoutes.use(authMiddleware);

// Respondent endpoints (requires project participant)
projectRoutes.post("/:id/responses", requireProjectRole(), submitProjectResponse);
projectRoutes.get("/:id/responses", requireProjectRole(), getProjectResponses);
