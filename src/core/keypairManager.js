const { Keypair } = require("@solana/web3.js");
const { Buffer } = require("buffer");
const { getConfig } = require("../config/environment");
const logger = require("./logger");

let cachedKeypair = null;

/**
 * Load keypair from secure storage (base64 encoded)
 * NEVER logs the private key
 * @returns {Keypair}
 */
function getKeypair() {
    try {
        // Return cached keypair to avoid repeated decoding
        if (cachedKeypair) {
            return cachedKeypair;
        }

        const config = getConfig();
        const privateKeyBase64 = config.PRIVATE_KEY_BASE64;

        if (!privateKeyBase64) {
            throw new Error("PRIVATE_KEY_BASE64 environment variable not set");
        }

        // Decode base64 to buffer
        const privateKeyBytes = Buffer.from(privateKeyBase64, "base64");

        // Validate key length (should be 64 bytes for Ed25519)
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
            // NEVER log the actual key data
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
        logger.error("Keypair verification failed", { error: err.message });
        throw err;
    }
}

module.exports = {
    getKeypair,
    verifyKeypair
};
