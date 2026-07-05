const { Keypair } = require("@solana/web3.js");
const bs58 = require("bs58");
const { getConfig } = require("../config/environment");
const logger = require("./logger");

let cachedKeypair = null;

/**
 * Load keypair from Base58 encoded private key
 */
function getKeypair() {
    try {
        if (cachedKeypair) {
            return cachedKeypair;
        }

        const config = getConfig();
        const privateKeyBase58 = config.PRIVATE_KEY_BASE58;

        if (!privateKeyBase58) {
            throw new Error("PRIVATE_KEY_BASE58 environment variable not set");
        }

        const privateKeyBytes = bs58.decode(privateKeyBase58);

        if (privateKeyBytes.length !== 64) {
            throw new Error(
                `Invalid private key length: ${privateKeyBytes.length} (expected 64)`
            );
        }

        cachedKeypair = Keypair.fromSecretKey(privateKeyBytes);

        logger.debug("Keypair loaded successfully");
        return cachedKeypair;
    } catch (err) {
        logger.error("Failed to load keypair", {
            error: err.message,
        });
        throw err;
    }
}

/**
 * Verify the loaded keypair matches expected public key
 */
function verifyKeypair() {
    try {
        const config = getConfig();
        const keypair = getKeypair();

        if (keypair.publicKey.toString() !== config.PUBLIC_KEY) {
            throw new Error(
                "Loaded keypair public key does not match PUBLIC_KEY environment variable"
            );
        }

        logger.info("Keypair verification passed");
        return true;
    } catch (err) {
        logger.error("Keypair verification failed", {
            error: err.message,
        });
        throw err;
    }
}

module.exports = {
    getKeypair,
    verifyKeypair,
};
