const { Keypair } = require("@solana/web3.js");
const bs58 = require("bs58");
const { getConfig } = require("../config/environment");
const logger = require("./logger");

let cachedKeypair = null;

function decodeSecret(secret) {
  // prefer base58 (your preferred format), fallback to base64
  // return Uint8Array (64 bytes) or throw
  if (!secret || typeof secret !== "string") {
    throw new Error("PRIVATE_KEY not set or invalid");
  }

  // try base58
  try {
    const bytes = bs58.decode(secret);
    if (bytes.length === 64) return Uint8Array.from(bytes);
  } catch (e) {
    // ignore, try base64
  }

  // try base64
  try {
    const buf = Buffer.from(secret, "base64");
    if (buf.length === 64) return Uint8Array.from(buf);
  } catch (e) {
    // ignore
  }

  throw new Error("PRIVATE_KEY must be base58 or base64 encoded 64-byte secret key");
}

/**
 * Load keypair from secret (bs58 or base64)
 */
function getKeypair() {
  try {
    if (cachedKeypair) return cachedKeypair;

    const config = getConfig();
    const secret = config.PRIVATE_KEY_BASE58 || config.PRIVATE_KEY_BASE64;

    if (!secret) {
      throw new Error("PRIVATE_KEY_BASE58 or PRIVATE_KEY_BASE64 environment variable not set");
    }

    const secretBytes = decodeSecret(secret);
    cachedKeypair = Keypair.fromSecretKey(secretBytes);

    logger.debug("Keypair loaded successfully");
    return cachedKeypair;
  } catch (err) {
    logger.error("Failed to load keypair", { error: err.message });
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
      throw new Error("Loaded keypair public key does not match PUBLIC_KEY environment variable");
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
  verifyKeypair,
};