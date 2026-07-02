const { getConfig } = require("../config/environment");

const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

function getCurrentLevel() {
    const config = getConfig();
    return LOG_LEVELS[config.LOG_LEVEL] || LOG_LEVELS.info;
}

function shouldLog(level) {
    return LOG_LEVELS[level] <= getCurrentLevel();
}

function log(level, message, data = null) {
    if (!shouldLog(level)) return;

    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        message,
        ...(data && { data })
    }));
}

module.exports = {
    error: (msg, data) => log("error", msg, data),
    warn: (msg, data) => log("warn", msg, data),
    info: (msg, data) => log("info", msg, data),
    debug: (msg, data) => log("debug", msg, data),
};
