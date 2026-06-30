function log(type, message, data = null) {
    console.log(JSON.stringify({
        time: new Date().toISOString(),
        type,
        message,
        data
    }));
}

module.exports = { log }
