
const redis = require("../core/redis");

async function idempotency(key, fn, ttl = 600) {
    const cached = await redis.get(key);

    if (cached) {
        return JSON.parse(cached);
    }

    const result = await fn();

    await redis.set(
        key,
        JSON.stringify(result),
        "EX",
        ttl
    );

    return result;
}

module.exports = idempotency;
