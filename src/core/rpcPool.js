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
