import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { submitResponseSchema } from "../middleware/validate";

export async function submitResponse(req: Request, res: Response, next: NextFunction) {
    try {
        const questionnaireId = parseInt(req.params.id as string, 10);
        if (isNaN(questionnaireId)) {
            res.status(400).json({ error: "Invalid questionnaire ID" });
            return;
        }

        const data = submitResponseSchema.parse(req.body);

        // Verify questionnaire exists
        const questionnaire = await prisma.questionnaire.findUnique({ where: { id: questionnaireId } });
        if (!questionnaire) {
            res.status(404).json({ error: "Questionnaire not found" });
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

        res.status(201).json({ message: "Response submitted", response });
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

        res.json(responses);
    } catch (err) {
        next(err);
    }
}
