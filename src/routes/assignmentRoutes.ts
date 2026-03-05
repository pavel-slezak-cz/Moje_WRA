import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { requireAssignmentOwner } from "../middleware/adminGuard";
import { getAssignmentInstrument } from "../controllers/respondentController";

export const assignmentRoutes = Router();

assignmentRoutes.use(authMiddleware);

assignmentRoutes.get("/:id/instrument", requireAssignmentOwner, getAssignmentInstrument);
