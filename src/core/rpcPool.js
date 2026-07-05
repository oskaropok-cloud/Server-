const { Connection } = require("@solana/web3.js");
const logger = require("./logger");
const { getConfig } = require("../config/environment");

class RpcPool {
    constructor(urls, timeout, retryAttempts) {
        this.rpcUrls = urls;
        this.timeout = timeout;
        this.retryAttempts = retryAttempts;

        this.currentIndex = 0;
        this.health = new Map();

        urls.forEach(url => this.health.set(url, { failures: 0, healthy: true }));
    }

    getConnection() {
        const url = this.rpcUrls[this.currentIndex % this.rpcUrls.length];
        return new Connection(url, "confirmed");
    }

    markHealthy(url) {
        const entry = this.health.get(url);
        if (entry) {
            entry.failures = 0;
            entry.healthy = true;
        }
    }

    markFailure(url) {
        const entry = this.health.get(url);
        if (entry) {
            entry.failures++;
            if (entry.failures >= 3) {
                entry.healthy = false;
                logger.warn(`RPC endpoint marked unhealthy: ${url}`);
            }
        }

        this.currentIndex = (this.currentIndex + 1) % this.rpcUrls.length;
    }

    getStatus() {
        return Array.from(this.health.entries()).map(([url, status]) => ({
            url,
            healthy: status.healthy,
            failures: status.failures
        }));
    }
}

let poolInstance = null;

function getPool() {
    if (!poolInstance) {
        const config = getConfig();
        poolInstance = new RpcPool(
            config.RPC_URLS,
            config.RPC_TIMEOUT_MS,
            config.RPC_RETRY_ATTEMPTS
        );
        logger.info("RPC pool initialized", {
            endpoints: config.RPC_URLS.length
        });
    }
    return poolInstance;
}

async function withRetry(fn, operationName = "RPC call") {
    const pool = getPool();
    let lastError;

    for (let attempt = 0; attempt < pool.retryAttempts; attempt++) {
        try {
            const connection = pool.getConnection();
            const result = await Promise.race([
                fn(connection),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("RPC timeout")), pool.timeout)
                )
            ]);

            const url = connection.rpcEndpoint;
            pool.markHealthy(url);

            return result;
        } catch (err) {
            lastError = err;
            const url = err.connection?.rpcEndpoint || null;
            const markUrl = url || pool.rpcUrls[pool.currentIndex % pool.rpcUrls.length];
            pool.markFailure(markUrl);

            logger.warn(`${operationName} attempt ${attempt + 1} failed`, {
                error: err.message,
                attempt: attempt + 1,
                totalAttempts: pool.retryAttempts
            });

            if (attempt < pool.retryAttempts - 1) {
                const delay = Math.min(100 * Math.pow(2, attempt), 2000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    logger.error(`${operationName} failed after all retries`, {
        error: lastError.message
    });
    throw lastError;
}

module.exports = {
    getPool,
    withRetry
};
