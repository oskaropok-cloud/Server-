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
       
