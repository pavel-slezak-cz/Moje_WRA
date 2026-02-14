const http = require("http");
const { healthHandler } = require("./routes/health");
const { feedbackHandler } = require("./routes/feedback");

const PORT = 3000;

const server = http.createServer((req, res) => {
    if (req.url === "/health") {
        healthHandler(req, res);
    } else if (req.url?.startsWith("/feedback")) {
        feedbackHandler(req, res);
    } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
    }
});

server.listen(PORT, () => {
    console.log(`Server běží na http://localhost:${PORT}`);
});
