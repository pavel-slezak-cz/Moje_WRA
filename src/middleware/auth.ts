import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { sendError } from "../utils/response";

export interface AuthPayload {
    userId: number;
    email: string;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        sendError(res, "Missing or invalid token", 401, "AUTH_REQUIRED");
        return;
    }

    const token = header.slice(7);
    try {
        const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
        req.user = payload;
        next();
    } catch {
        sendError(res, "Invalid or expired token", 401, "TOKEN_INVALID");
    }
}
