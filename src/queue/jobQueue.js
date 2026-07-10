const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const { getConfig } = require("../config/environment");
const logger = require("../core/logger");

let connection = null;
let txQueue = null;

/**
 * Initialize job queue with resilient Redis connection
 */
function initQueue() {
    const config = getConfig();

    connection = new IORedis(config.REDIS_URL, {
        connectTimeout: config.REDIS_TIMEOUT_MS,
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        enableOfflineQueue: false,
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            logger.warn(`Redis queue reconnection attempt ${times}, delaying ${delay}ms`);
            return delay;
        }
    });

    connection.on("error", (err) => {
        logger.error("Queue Redis error", { error: err.message });
    });

    txQueue = new Queue("tx", {
        connection,
        defaultJobOptions: {
            removeOnComplete: {
                age: 3600, // Keep completed jobs for 1 hour for audit trail
            },
            removeOnFail: false, // Keep failed jobs for debugging
            attempts: config.JOB_ATTEMPTS,
            backoff: {
                type: "exponential",
                delay: 500, // Start with 500ms, exponentially increase
            },
            timeout: config.JOB_TIMEOUT_MS,
        },
    });

    logger.info("Job queue initialized");
    return { connection, txQueue };
}

/**
 * Get or initialize queue
 */
function getQueue() {
    if (!txQueue) {
        initQueue();
    }
    return txQueue;
}

/**
 * Get queue connection for workers
 */
function getConnection() {
    if (!connection) {
        initQueue();
    }
    return connection;
}

/**
 * Submit job to queue
 */
async function submitJob(publicKey, signedTx) {
    try {
        const queue = getQueue();

        const job = await queue.add("drain", {
            publicKey,
            signedTx,
            timestamp: Date.now()
        });

        logger.info("Job submitted", {
            jobId: job.id,
            publicKey
        });

        return job.id;
    } catch (err) {
        logger.error("Failed to submit job", { error: err.message });
        throw err;
    }
}

/**
 * Check queue health
 */
async function getQueueStatus() {
    try {
        const queue = getQueue();
        const counts = await queue.getJobCounts();
        return {
            healthy: true,
            ...counts
        };
    } catch (err) {
        logger.error("Failed to get queue status", { error: err.message });
        return {
            healthy: false,
            error: err.message
        };
    }
}

module.exports = {
    getQueue,
    getConnection,
    getQueueStatus,
    initQueue,
    submitJob
};
