const { Connection } = require("@solana/web3.js");
const { getConfig } = require("../config/environment");
const logger = require("./logger");

class RPCPool {
    constructor() {
        const config = getConfig();
        this.rpcUrls = config.RPC_URLS;
        this.timeout = config.RPC_TIMEOUT_MS;
        this.retryAttempts = config.RPC_RETRY_ATTEMPTS;

        // Track health of each RPC
        this.health = {};
        this.lastUsed = {};
        this.rpcUrls.forEach(url => {
            this.health[url] = { failures: 0, lastFailure: null };
            this.lastUsed[url] = 0;
        });

        // Round-robin index
        this.currentIndex = 0;
    }

    /**
     * Get the best available RPC endpoint
     * Prefers healthy endpoints, avoids recently failed ones
     */
    selectRPC() {
        const now = Date.now();
        const healthyRpcs = this.rpcUrls.filter(url => {
            const h = this.health[url];
            // Consider endpoint healthy if:
            // - No failures, OR
            // - Last failure was > 30 seconds ago, OR
            // - Less than 2 failures
            if (h.failures === 0) return true;
            if (!h.lastFailure) return true;
            if (now - h.lastFailure > 30000) return true;
            if (h.failures < 2) return true;
            return false;
        });

        let selectedUrl;
        if (healthyRpcs.length > 0) {
            // Round-robin among healthy RPCs
            const healthyIndex = this.currentIndex % healthyRpcs.length;
            selectedUrl = healthyRpcs[healthyIndex];
            this.currentIndex++;
        } else {
            // Fallback: use the one with oldest failure
            selectedUrl = this.rpcUrls.reduce((best, url) => {
                const bestFailTime = this.health[best].lastFailure || 0;
                const urlFailTime = this.health[url].lastFailure || 0;
                return urlFailTime < bestFailTime ? url : best;
            });
        }

        logger.debug("RPC selected", { url: selectedUrl });
        return selectedUrl;
    }

    /**
     * Create a Connection with the selected RPC
     */
    getConnection() {
        const url = this.selectRPC();
        return new Connection(url, "confirmed");
    }

    /**
     * Mark RPC as failed
     */
    markFailure(url) {
        if (this.health[url]) {
            this.health[url].failures++;
            this.health[url].lastFailure = Date.now();
            logger.warn("RPC marked as failed", {
                url,
                failureCount: this.health[url].failures
            });
        }
    }

    /**
     * Mark RPC as healthy again
     */
    markHealthy(url) {
        if (this.health[url]) {
            this.health[url].failures = 0;
            this.health[url].lastFailure = null;
        }
    }

    /**
     * Get health status of all RPCs
     */
    getStatus() {
        return Object.entries(this.health).map(([url, h]) => ({
            url,
            failures: h.failures,
            lastFailure: h.lastFailure
        }));
    }
}

let pool = null;

function getPool() {
    if (!pool) {
        pool = new RPCPool();
    }
    return pool;
}

/**
 * Execute a function with automatic RPC retry
 */
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

            // Success - mark this RPC as healthy
            const url = connection.rpcEndpoint;
            pool.markHealthy(url);

            return result;
        } catch (err) {
            lastError = err;
            const currentUrl = pool.rpcUrls[pool.currentIndex % pool.rpcUrls.length];
            pool.markFailure(currentUrl);

            logger.warn(`${operationName} attempt ${attempt + 1} failed`, {
                error: err.message,
                attempt: attempt + 1,
                totalAttempts: pool.retryAttempts
            });

            // Exponential backoff
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
    getConnection: () => getPool().getConnection(),
    withRetry
};
