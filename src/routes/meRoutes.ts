import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { listMyAssignments } from "../controllers/respondentController";

export const meRoutes = Router();

meRoutes.use(authMiddleware);

meRoutes.get("/assignments", listMyAssignments);
