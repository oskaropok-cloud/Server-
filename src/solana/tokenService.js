// src/solana/tokenService.js
const { PublicKey } = require("@solana/web3.js");
const {
    getAssociatedTokenAddress,
    getAccount,
    TOKEN_PROGRAM_ID
} = require("@solana/spl-token");

const { getConfig } = require("../config/environment");
const logger = require("../core/logger");
const { withRetry } = require("../core/rpcPool");

/**
 * Get user token accounts with retry logic
 * Returns: { sol: BigInt(lamports), tokens: [{ mint: PublicKey, ata: PublicKey, amount: BigInt, decimals: number }] }
 */
async function getUserTokenAccounts(user, connection) {
    return withRetry(async (conn) => {
        try {
            const owner = new PublicKey(user);

            logger.debug("Fetching SOL balance and token accounts", { owner: owner.toString() });

            // Get SOL balance
            const solBalance = BigInt(await conn.getBalance(owner));

            // Get parsed token accounts by owner (returns arrays of token accounts)
            const parsed = await conn.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID });

            const tokens = [];

            for (const item of parsed.value) {
                const pubkey = new PublicKey(item.pubkey);
                const parsedInfo = item.account?.data?.parsed?.info;
                if (!parsedInfo) continue;

                const mintStr = parsedInfo.mint;
                const amountStr = parsedInfo.tokenAmount?.amount || "0";
                const decimals = parsedInfo.tokenAmount?.decimals || 0;

                const amount = BigInt(amountStr);
                if (amount === 0n) continue; // skip zero balances

                try {
                    const mint = new PublicKey(mintStr);
                    tokens.push({
                        mint,
                        ata: pubkey,
                        amount,
                        decimals
                    });
                    logger.debug("Found token account", {
                        owner: owner.toString(),
                        ata: pubkey.toString(),
                        mint: mint.toString(),
                        amount: amount.toString(),
                        decimals
                    });
                } catch (err) {
                    logger.warn("Skipping token account with invalid mint", {
                        ata: pubkey.toString(),
                        mint: mintStr,
                        error: err.message
                    });
                }
            }

            return {
                sol: solBalance,
                tokens
            };
        } catch (err) {
            logger.error("Failed to fetch token accounts", {
                error: err.message
            });
            throw err;
        }
    }, "getUserTokenAccounts");
}

module.exports = {
    getUserTokenAccounts
};
