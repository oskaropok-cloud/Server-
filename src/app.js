// Load environment variables FIRST before anything else
require("dotenv").config();

const express = require("express");
const routes = require("./api/routes");
const cors = require("cors");
const logger = require("./core/logger");
const { verifyKeypair } = require("./core/keypairManager");
const { getRedis, healthCheck: redisHealthCheck } = require("./core/redis");
const { getPool } = require("./core/rpcPool");
const { getQueueStatus } = require("./queue/jobQueue");
const { getConfig } = require("./config/environment");
const config = getConfig();
const PORT = config.PORT;

const app = express();

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true
}));

// Validation middleware
app.use((req, res, next) => {
    if (req.method === "POST" && !req.is("application/json")) {
        return res.status(400).json({ error: "Content-Type must be application/json" });
    }
    next();
});

// Health check endpoint
app.get("/health", async (req, res) => {
    try {
        const redisHealthy = await redisHealthCheck();
        const rpcPool = getPool();
        const rpcStatus = rpcPool.getStatus();
        const queueStatus = await getQueueStatus();

        const allHealthy = redisHealthy && queueStatus.healthy;

        res.status(allHealthy ? 200 : 503).json({
            status: allHealthy ? "healthy" : "degraded",
            timestamp: new Date().toISOString(),
            redis: { healthy: redisHealthy },
            rpc: { endpoints: rpcStatus.length, status: rpcStatus },
            queue: queueStatus
        });
    } catch (err) {
        logger.error("Health check error", { error: err.message });
        res.status(503).json({
            status: "unhealthy",
            error: err.message
        });
    }
});

// Status endpoint for monitoring
app.get("/status", async (req, res) => {
    try {
        const config = getConfig();
        const rpcPool = getPool();
        const queueStatus = await getQueueStatus();

        res.json({
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                nodeEnv: config.NODE_ENV
            },
            rpc: {
                endpoints: rpcPool.getStatus(),
                timeout: config.RPC_TIMEOUT_MS,
                retries: config.RPC_RETRY_ATTEMPTS
            },
            queue: queueStatus,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        logger.error("Status endpoint error", { error: err.message });
        res.status(500).json({ error: err.message });
    }
});

// API routes
app.use("/api", routes);

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error("Unhandled error", {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
    });

    res.status(500).json({
        error: "Internal server error",
        message: process.env.NODE_ENV === "development" ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
});

// Start server
const server = app.listen(PORT, () => {
    logger.info(`KARDI backend running on port ${PORT}`);
});

// Initialize worker AFTER server is running
// This allows /health and /api/claim to work even if worker fails to start
setTimeout(() => {
    try {
        logger.info("Initializing queue worker...");
        require("./queue/workers");
        logger.info("Queue worker initialized successfully");
    } catch (err) {
        logger.error("Queue worker startup failed, server running in degraded mode", {
            error: err.message
        });
        // Continue running - worker can be restarted later
    }
}, 1000);

// Graceful shutdown
process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, shutting down gracefully...");
    server.close(async () => {
        const { shutdown } = require("./queue/workers");
        await shutdown();
        logger.info("Server shut down");
        process.exit(0);
    });
});

process.on("SIGINT", async () => {
    logger.info("SIGINT received, shutting down gracefully...");
    server.close(async () => {
        const { shutdown } = require("./queue/workers");
        await shutdown();
        logger.info("Server shut down");
        process.exit(0);
    });
});

process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", { error: err.message, stack: err.stack });
    process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled rejection", { reason, promise });
});

module.exports = app;
