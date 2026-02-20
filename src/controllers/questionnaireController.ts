import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";

export async function getAll(req: Request, res: Response, next: NextFunction) {
    try {
        const questionnaires = await prisma.questionnaire.findMany({
            select: { id: true, title: true, description: true, createdAt: true },
            orderBy: { createdAt: "desc" },
        });
        res.json(questionnaires);
    } catch (err) {
        next(err);
    }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
    try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) {
            res.status(400).json({ error: "Invalid questionnaire ID" });
            return;
        }

        const questionnaire = await prisma.questionnaire.findUnique({ where: { id } });
        if (!questionnaire) {
            res.status(404).json({ error: "Questionnaire not found" });
            return;
        }

        res.json(questionnaire);
    } catch (err) {
        next(err);
    }
}
