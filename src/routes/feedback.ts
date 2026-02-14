import { IncomingMessage, ServerResponse } from "http";
import { Feedback } from "../types/feedback";
import { randomUUID } from "crypto";

// in-memory storage
const feedbacks: Feedback[] = [];

export function feedbackHandler(req: IncomingMessage, res: ServerResponse) {
    if (req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(feedbacks));
    } else if (req.method === "POST") {
        let body = "";
        req.on("data", chunk => (body += chunk));
        req.on("end", () => {
            try {
                const data = JSON.parse(body);

                // validace minimálně základních polí
                if (!data.user || !data.answers || typeof data.answers !== "object") {
                    throw new Error("Invalid feedback format");
                }

                const feedback: Feedback = {
                    id: randomUUID(),
                    user: data.user,
                    answers: data.answers,
                    createdAt: new Date().toISOString(),
                };

                feedbacks.push(feedback);

                res.writeHead(201, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ message: "Feedback received", feedback }));
            } catch (err: any) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: err.message || "Invalid JSON" }));
            }
        });
    } else {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method Not Allowed" }));
    }
}
