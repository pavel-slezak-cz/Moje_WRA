import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { getResponses } from "../controllers/feedbackController";

export const feedbackRoutes = Router();

feedbackRoutes.use(authMiddleware);

// POST /questionnaires/:id/responses — mounted under /questionnaires in app.ts via sub-route
// But since this router is mounted at /responses, we also expose:
// GET /responses — list own responses
feedbackRoutes.get("/", getResponses);
