import express from "express";
import cors from "cors";
import { authRoutes } from "./routes/authRoutes";
import { questionnaireRoutes } from "./routes/questionnaireRoutes";
import { feedbackRoutes } from "./routes/feedbackRoutes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

// Routes
app.use("/auth", authRoutes);
app.use("/questionnaires", questionnaireRoutes);
app.use("/responses", feedbackRoutes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
