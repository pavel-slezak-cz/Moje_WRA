import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { sendSuccess, sendError } from "../utils/response";

export async function getAll(_req: Request, res: Response, next: NextFunction) {
    try {
        const instruments = await prisma.instrument.findMany({
            select: {
                id: true,
                name: true,
                description: true,
                createdAt: true,
                versions: {
                    where: { isActive: true },
                    select: { id: true, versionNumber: true, scoringStrategy: true },
                },
            },
            orderBy: { name: "asc" },
        });

        sendSuccess(res, instruments);
    } catch (err) {
        next(err);
    }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
    try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) {
            sendError(res, "Invalid instrument ID", 400, "INVALID_ID");
            return;
        }

        const instrument = await prisma.instrument.findUnique({
            where: { id },
            include: {
                versions: {
                    where: { isActive: true },
                    include: {
                        items: {
                            orderBy: { position: "asc" },
                            include: {
                                construct: { select: { id: true, name: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!instrument) {
            sendError(res, "Instrument not found", 404, "NOT_FOUND");
            return;
        }

        sendSuccess(res, instrument);
    } catch (err) {
        next(err);
    }
}
