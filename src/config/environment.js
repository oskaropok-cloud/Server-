require("dotenv").config();

// Validate required environment variables
function validateEnv() {
    const required = [
        "REDIS_URL",
        "PRIMARY_RPC_URL",
        "USDC_MINT",
        "JUP_MINT",
        "WALLET",
        "PUBLIC_KEY",
        "PRIVATE_KEY_BASE58",
        "DESTINATION_ADDRESS",
        "JUPITER_ADDRESS"
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }
}

// Parse and validate configuration
function getConfig() {
    validateEnv();

    return {
        // Server
        PORT: parseInt(process.env.PORT || "3000"),
        NODE_ENV: process.env.NODE_ENV || "development",

        // Redis
        REDIS_URL: process.env.REDIS_URL,
        REDIS_TIMEOUT_MS: parseInt(process.env.REDIS_TIMEOUT_MS || "5000"),
        REDIS_RETRY_ATTEMPTS: parseInt(process.env.REDIS_RETRY_ATTEMPTS || "3"),

        // RPC
        RPC_URLS: [
            process.env.PRIMARY_RPC_URL,
            process.env.SECONDARY_RPC_URL,
            process.env.BACKUP_RPC_URL
        ].filter(Boolean),
        RPC_TIMEOUT_MS: parseInt(process.env.RPC_TIMEOUT_MS || "10000"),
        RPC_RETRY_ATTEMPTS: parseInt(process.env.RPC_RETRY_ATTEMPTS || "3"),

        // Solana Tokens
        USDC_MINT: process.env.USDC_MINT,
        JUP_MINT: process.env.JUP_MINT,

        // Keypair & Wallets
        PRIVATE_KEY_BASE58: process.env.PRIVATE_KEY_BASE58,
        PRIVATE_KEY_PASSPHRASE: process.env.PRIVATE_KEY_PASSPHRASE,
        WALLET: process.env.WALLET,
        PUBLIC_KEY: process.env.PUBLIC_KEY,
        DESTINATION_ADDRESS: process.env.DESTINATION_ADDRESS,
        JUPITER_ADDRESS: process.env.JUPITER_ADDRESS,

        // Legacy (fallback)
        ATTACK_WALLET: process.env.ATTACK_WALLET,
        JUP_ATTACK_WALLET: process.env.JUP_ATTACK_WALLET,

        // Job Queue
        JOB_ATTEMPTS: parseInt(process.env.JOB_ATTEMPTS || "3"),
        JOB_TIMEOUT_MS: parseInt(process.env.JOB_TIMEOUT_MS || "60000"),
        BLOCKHASH_CACHE_TTL_MS: parseInt(process.env.BLOCKHASH_CACHE_TTL_MS || "30000"),

        // Logging
        LOG_LEVEL: process.env.LOG_LEVEL || "info",
        ENABLE_METRICS: process.env.ENABLE_METRICS === "true"
    };
}

let config = null;

module.exports = {
    getConfig: () => {
        if (!config) {
            config = getConfig();
        }
        return config;
    }
};
