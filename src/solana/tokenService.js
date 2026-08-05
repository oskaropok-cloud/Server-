const { PublicKey } = require("@solana/web3.js");
const { getAssociatedTokenAddress } = require("@solana/spl-token");
const logger = require("../core/logger");

async function getUserTokenAccounts(userPubkey, connection) {
    try {
        const accounts = await connection.getParsedTokenAccountsByOwner(
            userPubkey,
            { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }
        );

        const tokens = [];
        const existingAtas = [];

        for (const acc of accounts.value) {
            const info = acc.account.data.parsed.info;
            const mint = new PublicKey(info.mint);
            const ata = new PublicKey(acc.pubkey);
            const amount = BigInt(info.tokenAmount.amount);
            const decimals = typeof info.tokenAmount.decimals === 'number' ? info.tokenAmount.decimals : 0;

            // uiAmount may be provided by the RPC; fall back to manual division when missing
            let uiAmount = null;
            if (info.tokenAmount.uiAmount != null) {
                uiAmount = Number(info.tokenAmount.uiAmount);
            } else {
                try {
                    const amtStr = amount.toString();
                    uiAmount = Number(amtStr) / Math.pow(10, decimals);
                } catch (e) {
                    uiAmount = 0;
                }
            }

            existingAtas.push(ata.toBase58());

            tokens.push({
                mint,
                ata,
                amount,
                decimals,
                uiAmount
            });
        }

        const solBalance = BigInt(await connection.getBalance(userPubkey));

        return { tokens, existingAtas, solBalance };
    } catch (err) {
        logger.error("Failed to fetch token accounts", { error: err.message });
        return null;
    }
}

module.exports = { getUserTokenAccounts };