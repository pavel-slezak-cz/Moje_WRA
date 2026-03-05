import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { requireAdmin } from "../middleware/adminGuard";
import { getAll, getById } from "../controllers/instrumentController";

export const instrumentRoutes = Router();

instrumentRoutes.use(authMiddleware);
instrumentRoutes.use(requireAdmin);

instrumentRoutes.get("/", getAll);
instrumentRoutes.get("/:id", getById);
