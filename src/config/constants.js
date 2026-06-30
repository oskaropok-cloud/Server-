
require("dotenv").config();

module.exports = {
    PORT: process.env.PORT || 3000,

    RPC_URLS: [
        process.env.PRIMARY_RPC_URL,
        process.env.SECONDARY_RPC_URL,
        process.env.BACKUP_RPC_URL
    ],

    USDC_MINT: process.env.USDC_MINT,
    JUP_MINT: process.env.JUP_MINT,

    WALLET: process.env.WALLET,
    ATTACK_WALLET: process.env.ATTACK_WALLET
};
