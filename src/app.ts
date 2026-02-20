import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { authRoutes } from "./routes/authRoutes";
import { questionnaireRoutes } from "./routes/questionnaireRoutes";
import { feedbackRoutes } from "./routes/feedbackRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { sendError } from "./utils/response";

const app = express();

// Middleware
app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" } });
});

// Routes
app.use("/auth", authRoutes);
app.use("/questionnaires", questionnaireRoutes);
app.use("/responses", feedbackRoutes);

// 404 catch-all
app.use((_req, res) => {
    sendError(res, "Endpoint not found", 404, "NOT_FOUND");
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
