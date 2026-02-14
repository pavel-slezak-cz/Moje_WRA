import { IncomingMessage, ServerResponse } from "http";
import { getFeedback, addFeedback } from "../controllers/feedbackController.ts";

export const feedbackHandler = (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === "GET") {
        const feedback = getFeedback();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(feedback));
    } else if (req.method === "POST") {
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", () => {
            try {
                const data = JSON.parse(body);
                addFeedback(data);
                res.writeHead(201, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid JSON" }));
            }
        });
    } else {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method Not Allowed" }));
    }
};
