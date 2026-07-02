const { Connection } = require("@solana/web3.js");
const { Buffer } = require("buffer");
const logger = require("../core/logger");
const { withRetry } = require("../core/rpcPool");

/**
 * Execute a raw transaction on Solana
 * @param {string} txBase64 - Transaction serialized as base64
 * @param {Connection} connection - Solana connection
 * @returns {Promise<string>} Transaction signature
 */
async function executeTx(txBase64, connection) {
    return withRetry(async (conn) => {
        try {
            logger.debug("Executing transaction", {
                txPreview: txBase64.substring(0, 16) + "..."
            });

            // Decode and validate base64
            let txBuffer;
            try {
                txBuffer = Buffer.from(txBase64, "base64");
            } catch (err) {
                throw new Error(`Invalid base64 transaction: ${err.message}`);
            }

            const signature = await conn.sendRawTransaction(
                txBuffer,
                {
                    skipPreflight: false,
                    preflightCommitment: "confirmed",
                    maxRetries: 3
                }
            );

            logger.info("Transaction sent successfully", { signature });
            return signature;
        } catch (err) {
            // Log detailed error information for debugging
            if (err.message.includes("already processed")) {
                logger.info("Transaction already processed (likely duplicate)", {
                    error: err.message
                });
                throw new Error("Transaction already in flight");
            }

            if (err.message.includes("expired")) {
                logger.error("Transaction expired (blockhash too old)", {
                    error: err.message
                });
                throw new Error("Blockhash expired, retry with fresh blockhash");
            }

            if (err.message.includes("Insufficient")) {
                logger.error("Insufficient funds for transaction", {
                    error: err.message
                });
                throw new Error("Fee payer has insufficient SOL");
            }

            logger.error("Failed to execute transaction", {
                error: err.message
            });
            throw err;
        }
    }, "executeTx");
}

module.exports = { executeTx };
