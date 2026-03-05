import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { requireAdmin } from "../middleware/adminGuard";
import { getAll, getById } from "../controllers/questionnaireController";
import { submitResponse } from "../controllers/feedbackController";

export const questionnaireRoutes = Router();

questionnaireRoutes.use(authMiddleware);
questionnaireRoutes.use(requireAdmin);

questionnaireRoutes.get("/", getAll);
questionnaireRoutes.get("/:id", getById);
questionnaireRoutes.post("/:id/responses", submitResponse);
