const {
    getAssociatedTokenAddress,
    getAccount
} = require("@solana/spl-token");

const { PublicKey } = require("@solana/web3.js");

const USDC = new PublicKey(process.env.USDC_MINT);
const JUP = new PublicKey(process.env.JUP_MINT);

async function getUserTokenAccounts(user, connection) {
    const owner = new PublicKey(user);

    const usdcATA = await getAssociatedTokenAddress(USDC, owner);
    const jupATA = await getAssociatedTokenAddress(JUP, owner);

    let usdc = 0n;
    let jup = 0n;

    try {
        usdc = (await getAccount(connection, usdcATA)).amount;
    } catch (error) {
        console.warn(`[tokenService] Failed to fetch USDC balance for ${user}:`, error.message);
    }

    try {
        jup = (await getAccount(connection, jupATA)).amount;
    } catch (error) {
        console.warn(`[tokenService] Failed to fetch JUP balance for ${user}:`, error.message);
    }

    return {
        usdcATA,
        jupATA,
        usdc,
        jup
    };
}

module.exports = {
    getUserTokenAccounts
};
