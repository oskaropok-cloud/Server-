const logger = require("./logger");
const { getConfig } = require("../config/environment");

class BlockhashCache {
    constructor() {
        const config = getConfig();
        this.ttl = config.BLOCKHASH_CACHE_TTL_MS;
        this.cache = {
            blockhash: null,
            fetched: null,
            lastSlot: null
        };
    }

    /**
     * Get cached blockhash if still valid
     */
    get() {
        if (!this.cache.blockhash) {
            return null;
        }

        const age = Date.now() - this.cache.fetched;
        if (age > this.ttl) {
            logger.debug("Blockhash expired", { age, ttl: this.ttl });
            return null;
        }

        logger.debug("Using cached blockhash", { age, ttl: this.ttl });
        return this.cache.blockhash;
    }

    /**
     * Set blockhash in cache
     */
    set(blockhash, slot = null) {
        this.cache.blockhash = blockhash;
        this.cache.fetched = Date.now();
        this.cache.lastSlot = slot;
        logger.debug("Blockhash cached", { blockhash: blockhash.substring(0, 8) });
    }

    /**
     * Invalidate cache (force fresh fetch)
     */
    invalidate() {
        this.cache.blockhash = null;
        this.cache.fetched = null;
        this.cache.lastSlot = null;
        logger.debug("Blockhash cache invalidated");
    }

    /**
     * Get cache status
     */
    getStatus() {
        return {
            cached: !!this.cache.blockhash,
            age: this.cache.fetched ? Date.now() - this.cache.fetched : null,
            ttl: this.ttl,
            blockhash: this.cache.blockhash ? this.cache.blockhash.substring(0, 8) + "..." : null
        };
    }
}

let cache = null;

function getCache() {
    if (!cache) {
        cache = new BlockhashCache();
    }
    return cache;
}

module.exports = {
    getCache,
    getBlockhash: () => getCache().get(),
    setBlockhash: (blockhash, slot) => getCache().set(blockhash, slot),
    invalidateBlockhash: () => getCache().invalidate(),
    getBlockhashStatus: () => getCache().getStatus()
};
