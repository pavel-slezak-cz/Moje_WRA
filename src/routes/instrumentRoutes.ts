import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { getAll, getById } from "../controllers/instrumentController";

export const instrumentRoutes = Router();

instrumentRoutes.use(authMiddleware);

instrumentRoutes.get("/", getAll);
instrumentRoutes.get("/:id", getById);
