import { Request, Response, NextFunction } from "express";

// Express requires all 4 params to identify this as an error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
    console.error(err);

    const status = err.status || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ error: message });
}
