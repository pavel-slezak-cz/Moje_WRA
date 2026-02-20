import dotenv from "dotenv";
dotenv.config();

export const env = {
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: process.env.JWT_SECRET || "default-secret",
    PORT: parseInt(process.env.PORT || "3000", 10),
    CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
};
