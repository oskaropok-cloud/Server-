const { Connection } = require("@solana/web3.js");
const { RPC_URLS } = require("../config/constants");

function getConnection() {
    const url = RPC_URLS[
        Math.floor(Math.random() * RPC_URLS.length)
    ];

    return new Connection(url, "confirmed");
}

module.exports = { getConnection };
