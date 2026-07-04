const { invalidateBlockhash } = require("../core/blockhashCache");
const logger = require("../core/logger");

async function executeTx(tx, connection) {
    try {
        const raw = tx.serialize();
        const sig = await connection.sendRawTransaction(raw, {
            skipPreflight: false
        });

        const confirmation = await connection.confirmTransaction(sig, "confirmed");

        if (confirmation.value.err) {
            if (confirmation.value.err.toString().includes("blockhash")) {
                invalidateBlockhash();
            }
            throw new Error("Transaction failed: " + confirmation.value.err);
        }

        return sig;
    } catch (err) {
        logger.error("TX execution failed", { error: err.message });
        throw err;
    }
}

module.exports = { executeTx };
