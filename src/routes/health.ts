import { IncomingMessage, ServerResponse } from "http";

export function healthHandler(req: IncomingMessage, res: ServerResponse) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
}
