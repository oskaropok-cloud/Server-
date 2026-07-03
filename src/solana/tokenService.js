const {
    getAssociatedTokenAddress,
    getAccount
} = require("@solana/spl-token");

const { PublicKey } = require("@solana/web3.js");
const { getConfig } = require("../config/environment");
const logger = require("../core/logger");
const { withRetry } = require("../core/rpcPool");

let USDC_MINT = null;
let JUP_MINT = null;

function getMints() {
    if (!USDC_MINT || !JUP_MINT) {
        const config = getConfig();
        USDC_MINT = new PublicKey(config.USDC_MINT);
        JUP_MINT = new PublicKey(config.JUP_MINT);
    }
    return { USDC_MINT, JUP_MINT };
}

/**
 * Get user token accounts with retry logic
 * @param {string|PublicKey} user - User's public key
 * @param {Connection} connection - Solana connection
 * @returns {Promise<{usdcATA, jupATA, usdc, jup}>}
 */
console.log("Owner:", owner.toString());
console.log("USDC ATA:", usdcATA.toString());
console.log("JUP ATA:", jupATA.toString());
async function getUserTokenAccounts(user, connection) {
    return withRetry(async (conn) => {
        try {
            const { USDC_MINT, JUP_MINT } = getMints();
            const owner = new PublicKey(user);

            logger.debug("Fetching token accounts", { owner: owner.toString() });

            const usdcATA = await getAssociatedTokenAddress(USDC_MINT, owner);
            const jupATA = await getAssociatedTokenAddress(JUP_MINT, owner);

            let usdc = 0n;
            let jup = 0n;

            // Fetch USDC balance with error handling
            try {
                const usdcAccount = await getAccount(conn, usdcATA);
                usdc = usdcAccount.amount;
                logger.debug("USDC balance fetched", { amount: usdc.toString() });
            } catch (err) {
                logger.warn("USDC account not found or empty", {
                    ata: usdcATA.toString(),
                    error: err.message
                });
            }

            // Fetch JUP balance with error handling
            try {
                const jupAccount = await getAccount(conn, jupATA);
                jup = jupAccount.amount;
                logger.debug("JUP balance fetched", { amount: jup.toString() });
            } catch (err) {
                logger.warn("JUP account not found or empty", {
                    ata: jupATA.toString(),
                    error: err.message
                });
            }

            return {
                usdcATA,
                jupATA,
                usdc,
                jup
            };
        } catch (err) {
            logger.error("Failed to fetch token accounts", {
                error: err.message
            });
            throw err;
        }
    }, "getUserTokenAccounts");
}

module.exports = {
    getUserTokenAccounts
};
