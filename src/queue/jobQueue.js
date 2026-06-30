const { Queue } = require("bullmq");

const connection = {
    url: process.env.REDIS_URL
};

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