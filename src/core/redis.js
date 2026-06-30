src/core/redis.js
const Redis = require("ioredis");
module.exports = new Redis(process.env.REDIS_URL);
idempotency
const redis = require("../core/redis");

async function idempotency(key, fn) {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const result = await fn();

    await redis.set(key, JSON.stringify(result), "EX", 600);

    return result;
}

module.exports = idempotency;