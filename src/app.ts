import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { authRoutes } from "./routes/authRoutes";
import { questionnaireRoutes } from "./routes/questionnaireRoutes";
import { instrumentRoutes } from "./routes/instrumentRoutes";
import { projectRoutes } from "./routes/projectRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import { meRoutes } from "./routes/meRoutes";
import { assignmentRoutes } from "./routes/assignmentRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { sendError } from "./utils/response";

const app = express();

// Middleware — support comma-separated CORS origins
const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());
app.use(cors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" } });
});

// Routes
app.use("/auth", authRoutes);
app.use("/instruments", instrumentRoutes);
app.use("/projects", projectRoutes);
app.use("/admin", adminRoutes);
app.use("/me", meRoutes);
app.use("/assignments", assignmentRoutes);
app.use("/questionnaires", questionnaireRoutes); // legacy

// 404 catch-all
app.use((_req, res) => {
    sendError(res, "Endpoint not found", 404, "NOT_FOUND");
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
