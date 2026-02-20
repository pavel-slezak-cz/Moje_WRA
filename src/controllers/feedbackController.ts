import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { submitResponseSchema } from "../middleware/validate";
import { sendSuccess, sendError } from "../utils/response";

export async function submitResponse(req: Request, res: Response, next: NextFunction) {
    try {
        const questionnaireId = parseInt(req.params.id as string, 10);
        if (isNaN(questionnaireId)) {
            sendError(res, "Invalid questionnaire ID", 400, "INVALID_ID");
            return;
        }

        const data = submitResponseSchema.parse(req.body);

        // Verify questionnaire exists
        const questionnaire = await prisma.questionnaire.findUnique({ where: { id: questionnaireId } });
        if (!questionnaire) {
            sendError(res, "Questionnaire not found", 404, "NOT_FOUND");
            return;
        }

        const response = await prisma.response.create({
            data: {
                userId: req.user!.userId,
                questionnaireId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                answers: data.answers as any,
            },
        });

        sendSuccess(res, response, 201);
    } catch (err) {
        next(err);
    }
}

export async function getResponses(req: Request, res: Response, next: NextFunction) {
    try {
        const responses = await prisma.response.findMany({
            where: { userId: req.user!.userId },
            include: {
                questionnaire: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        sendSuccess(res, responses);
    } catch (err) {
        next(err);
    }
}
