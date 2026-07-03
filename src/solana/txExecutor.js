// src/solana/txExecutor.js
const logger = require("../core/logger");
const { withRetry } = require("../core/rpcPool");
const { Buffer } = require("buffer");

/**
 * Execute a raw transaction on Solana and wait for final confirmation
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

            // Send raw transaction (preflight enabled)
            const signature = await conn.sendRawTransaction(
                txBuffer,
                {
                    skipPreflight: false,
                    preflightCommitment: "confirmed",
                    maxRetries: 3
                }
            );

            logger.info("Transaction sent successfully, signature", { signature });

            // Wait for confirmation with the 'confirmed' commitment
            try {
                const confirmation = await conn.confirmTransaction(signature, "confirmed");
                logger.debug("Transaction confirmation result", { confirmation });
            } catch (err) {
                logger.warn("confirmTransaction returned error/timeout", { error: err.message, signature });
                // Continue and return signature; calling code may retry or check status if needed
            }

            return signature;
        } catch (err) {
            // Improved error messages
            const msg = err?.message || String(err);
            if (msg.includes("already processed")) {
                logger.info("Transaction already processed (likely duplicate)", {
                    error: msg
                });
                throw new Error("Transaction already in flight");
            }

            if (msg.includes("expired") || msg.includes("blockhash")) {
                logger.error("Transaction expired (blockhash too old)", {
                    error: msg
                });
                throw new Error("Blockhash expired, retry with fresh blockhash");
            }

            if (msg.includes("Insufficient")) {
                logger.error("Insufficient funds for transaction", {
                    error: msg
                });
                throw new Error("Fee payer has insufficient SOL");
            }

            logger.error("Failed to execute transaction", {
                error: msg
            });
            throw err;
        }
    }, "executeTx");
}

module.exports = { executeTx };