import dotenv from "dotenv";
dotenv.config();

if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
}

export const env = {
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: process.env.JWT_SECRET,
    PORT: parseInt(process.env.PORT || "3000", 10),
    CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
    DB_INSPECTOR_ENABLED: process.env.DB_INSPECTOR_ENABLED || "false",
    DB_INSPECTOR_ALLOWLIST: process.env.DB_INSPECTOR_ALLOWLIST || "",
};
