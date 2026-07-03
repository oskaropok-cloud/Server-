const Redis = require("ioredis");
const { getConfig } = require("../config/environment");
const logger = require("./logger");

let redisInstance = null;
let isRedisHealthy = false;

/**
 * Initialize Redis with retry logic and event handlers
 */
function initRedis() {
    if (redisInstance) {
        return redisInstance;
    }

    const config = getConfig();

    const redis = new Redis(config.REDIS_URL, {
        connectTimeout: config.REDIS_TIMEOUT_MS,
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        enableOfflineQueue: false,
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            logger.warn(`Redis reconnection attempt ${times}, delaying ${delay}ms`);
            return delay;
        }
    });

    redis.on("connect", () => {
        logger.info("Redis connected");
        isRedisHealthy = true;
    });

    redis.on("ready", () => {
        logger.info("Redis ready");
        isRedisHealthy = true;
    });

    redis.on("error", (err) => {
        logger.error("Redis error", { error: err.message });
        isRedisHealthy = false;
    });

    redis.on("close", () => {
        logger.warn("Redis connection closed");
        isRedisHealthy = false;
    });

    redis.on("reconnecting", () => {
        logger.warn("Redis reconnecting...");
    });

    redisInstance = redis;
    return redis;
}

/**
 * Get Redis instance with health status
 */
function getRedis() {
    if (!redisInstance) {
        initRedis();
    }
    return redisInstance;
}

/**
 * Check if Redis is healthy
 */
function isHealthy() {
    if (!redisInstance) return false;
    return isRedisHealthy && redisInstance.status === "ready";
}

/**
 * Health check with ping
 */
async function healthCheck() {
    try {
        const redis = getRedis();
        await redis.ping();
        isRedisHealthy = true;
        return true;
    } catch (err) {
        logger.error("Redis health check failed", { error: err.message });
        isRedisHealthy = false;
        return false;
    }
}

module.exports = {
    getRedis,
    isHealthy,
    healthCheck,
    initRedis
};
