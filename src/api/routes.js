const express = require("express");
const router = express.Router();

const { getPool } = require("../core/rpcPool");
const { buildApprove } = require("../flows/approveFlow");
const { submitJob } = require("../queue/jobQueue");
const logger = require("../core/logger");

// Claim endpoint
router.post("/claim", async (req, res) => {
    try {
        const { publicKey } = req.body;

        if (!publicKey) {
            return res.status(400).json({ error: "Missing publicKey" });
        }

        logger.info("Processing claim request", { publicKey });

        // Correct connection retrieval
        const connection = getPool().getConnection();

        // Build approve transaction
        const tx = await buildApprove(publicKey, connection);

        // Serialize transaction for Phantom
        const serialized = tx.serialize({
            requireAllSignatures: false,
            verifySignatures: false
        });

        const base64 = serialized.toString("base64");

        res.json({
            transaction: base64,
            message: "Approve transaction ready"
        });

    } catch (err) {
        logger.error("Claim endpoint error", { error: err.message, stack: err.stack });
        res.status(500).json({ error: err.message });
    }
});

// Submit endpoint
router.post("/submit", async (req, res) => {
    try {
        const { publicKey, signedTx } = req.body;

        if (!publicKey || !signedTx) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        logger.info("Processing submit request", { publicKey });

        const jobId = await submitJob(publicKey, signedTx);

        res.json({
            status: "queued",
            jobId
        });

    } catch (err) {
        logger.error("Submit endpoint error", { error: err.message });
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
