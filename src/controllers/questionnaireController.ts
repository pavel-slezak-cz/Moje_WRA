import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { sendSuccess, sendError } from "../utils/response";

export async function getAll(req: Request, res: Response, next: NextFunction) {
    try {
        const questionnaires = await prisma.questionnaire.findMany({
            select: { id: true, title: true, description: true, createdAt: true },
            orderBy: { createdAt: "desc" },
        });
        sendSuccess(res, questionnaires);
    } catch (err) {
        next(err);
    }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
    try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) {
            sendError(res, "Invalid questionnaire ID", 400, "INVALID_ID");
            return;
        }

        const questionnaire = await prisma.questionnaire.findUnique({ where: { id } });
        if (!questionnaire) {
            sendError(res, "Questionnaire not found", 404, "NOT_FOUND");
            return;
        }

        sendSuccess(res, questionnaire);
    } catch (err) {
        next(err);
    }
}
