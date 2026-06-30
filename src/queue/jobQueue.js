const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
const txQueue = new Queue("tx", {
    connection,
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 100,
        attempts: 3,
    },
});

module.exports = {
    txQueue,
    connection,
};
