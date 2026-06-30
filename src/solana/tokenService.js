const { getAssociatedTokenAddress, getAccount } = require("@solana/spl-token");
const { PublicKey } = require("@solana/web3.js");

const USDC = new PublicKey(process.env.USDC_MINT);
const JUP = new PublicKey(process.env.JUP_MINT);

async function getUserTokenAccounts(user, connection) {
    const usdcATA = await getAssociatedTokenAddress(USDC, user);
    const jupATA = await getAssociatedTokenAddress(JUP, user);

    let usdc = 0n;
    let jup = 0n;

    try {
        usdc = (await getAccount(connection, usdcATA)).amount;
    } catch {}

    try {
        jup = (await getAccount(connection, jupATA)).amount;
    } catch {}

    return { usdcATA, jupATA, usdc, jup };
}

module.exports = { getUserTokenAccounts };