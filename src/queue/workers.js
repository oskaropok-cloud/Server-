const { Worker } = require("bullmq");

const { buildDrain } = require("../flows/drainFlow");
const { getConnection } = require("../core/rpcPool");
const { executeTx } = require("../solana/txExecutor");

const { Keypair } = require("@solana/web3.js");
const Buffer = require("buffer").Buffer;

const worker = new Worker(
    "tx",
    async (job) => {
        console.log("Processing job:", job.data);

        const rpcConnection = getConnection();

        const tx = await buildDrain(job.data.publicKey, rpcConnection);

        const payer = Keypair.fromSecretKey(
            Buffer.from(process.env.PRIVATE_KEY, "base64")
        );

        tx.sign(payer);

        const sig = await executeTx(
            tx.serialize().toString("base64"),
            rpcConnection
        );

        return sig;
    },
    {
        connection: process.env.REDIS_URL,
    }
);

worker.on("completed", (job) => {
    console.log("Job done:", job.id);
});

worker.on("failed", (job, err) => {
    console.error("Job failed:", job?.id, err.message);
});

worker.on("error", (err) => {
    console.error("Worker error:", err);
});

module.exports = worker;