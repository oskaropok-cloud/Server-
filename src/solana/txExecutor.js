const { Connection } = require("@solana/web3.js");

async function executeTx(tx, connection) {
    const signature = await connection.sendRawTransaction(
        Buffer.from(tx, "base64"),
        {
            skipPreflight: false,
            preflightCommitment: "confirmed",
        }
    );

    return signature;
}

module.exports = { executeTx };