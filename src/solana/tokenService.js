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

            existingAtas.push(ata.toBase58());

            tokens.push({
                mint,
                ata,
                amount
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
