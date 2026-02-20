import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/db";
import { env } from "../config/env";
import { hashPassword, comparePassword } from "../utils/hash";
import { registerSchema, loginSchema } from "../middleware/validate";

function signToken(userId: number, email: string): string {
    return jwt.sign({ userId, email }, env.JWT_SECRET, { expiresIn: "7d" });
}

export async function register(req: Request, res: Response, next: NextFunction) {
    try {
        const data = registerSchema.parse(req.body);

        const existing = await prisma.user.findUnique({ where: { email: data.email } });
        if (existing) {
            res.status(409).json({ error: "Email already registered" });
            return;
        }

        const passwordHash = await hashPassword(data.password);
        const user = await prisma.user.create({
            data: {
                email: data.email,
                name: data.name,
                passwordHash,
            },
        });

        const token = signToken(user.id, user.email);
        res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (err) {
        next(err);
    }
}

export async function login(req: Request, res: Response, next: NextFunction) {
    try {
        const data = loginSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email: data.email } });
        if (!user) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }

        const valid = await comparePassword(data.password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }

        const token = signToken(user.id, user.email);
        res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (err) {
        next(err);
    }
}
