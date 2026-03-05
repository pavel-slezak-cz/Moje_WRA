import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import prisma from "../config/db";
import { sendError } from "../utils/response";

export interface AuthPayload {
    userId: number;
    email: string;
    role: "SUPERUSER" | "STAFF" | "RESPONDENT";
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}

interface JwtPayload {
    userId: number;
    email: string;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        sendError(res, "Missing or invalid token", 401, "AUTH_REQUIRED");
        return;
    }

    const token = header.slice(7);
    try {
        const jwtData = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

        // Fetch role from DB (minimal select)
        const user = await prisma.user.findUnique({
            where: { id: jwtData.userId },
            select: { id: true, role: true },
        });
        if (!user) {
            sendError(res, "User no longer exists", 401, "TOKEN_INVALID");
            return;
        }

        req.user = { userId: jwtData.userId, email: jwtData.email, role: user.role };
        next();
    } catch (err) {
        if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
            sendError(res, "Invalid or expired token", 401, "TOKEN_INVALID");
            return;
        }
        next(err);
    }
}
