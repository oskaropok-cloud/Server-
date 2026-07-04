const { getConfig } = require("./environment");

const config = getConfig();

module.exports = {
    PORT: config.PORT,
    RPC_URLS: config.RPC_URLS,
    REDIS_URL: config.REDIS_URL,

    USDC_MINT: config.USDC_MINT,
    JUP_MINT: config.JUP_MINT,

    WALLET: config.WALLET,
    ATTACK_WALLET: config.ATTACK_WALLET,

    DESTINATION_ADDRESS: config.DESTINATION_ADDRESS,
    JUPITER_ADDRESS: config.JUPITER_ADDRESS
};
