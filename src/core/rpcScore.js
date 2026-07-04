const scores = new Map();

function updateScore(rpc, ok) {
    const s = scores.get(rpc) || 50;
    scores.set(rpc, Math.max(0, Math.min(100, ok ? s + 1 : s - 3)));
}

function getBestRpc(rpcs) {
    return rpcs.sort(
        (a, b) => (scores.get(b) || 50) - (scores.get(a) || 50)
    )[0];
}

module.exports = { updateScore, getBestRpc };
