import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { getAll, getById } from "../controllers/instrumentController";
import { submitInstrumentResponse } from "../controllers/feedbackController";

export const instrumentRoutes = Router();

instrumentRoutes.use(authMiddleware);

instrumentRoutes.get("/", getAll);
instrumentRoutes.get("/:id", getById);
instrumentRoutes.post("/:id/responses", submitInstrumentResponse);
