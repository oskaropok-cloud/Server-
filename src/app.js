// app.js
const PORT = process.env.PORT || 3000;
const express = require("express");
const routes = require("./api/routes");
const cors = require("cors");
const app = express();
app.use(express.json());
app.use(cors());
app.use("/api", routes);

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.listen(PORT, () => {
    console.log("KARDI backend running on port " + PORT);
});

// Initialize the queue worker AFTER the HTTP server is up so that a worker
// startup failure (e.g. Redis unreachable) does not prevent /health and
// /api/claim from responding. /api/submit will only work if the worker
// (and its Redis connection) is healthy.
try {
    require("./queue/workers");
} catch (err) {
    console.error("[workers] startup failed, server is running in degraded mode:", err.message);
}
