# ENVIRONMENT VARIABLES GUIDE

## Complete List of Required & Optional Environment Variables

### Copy your actual values from the .env file you provided and set these variables:

---

## 🔴 CRITICAL - MUST SET (Server won't start without these)

```bash
# Redis Connection
REDIS_URL=rediss://default:gQAAAAAAAl6EAAIgcDI0ZjM3MjJmMGYwODc0ZTVhYjA2YzJjMzhhNThlM2RiOA@rich-skink-155268.upstash.io:6379

# RPC Endpoints (at least PRIMARY_RPC_URL required)
PRIMARY_RPC_URL=https://mainnet.helius-rpc.com/?api-key=0797e746-de44-4bdd-9b54-1a2089dc9d95
SECONDARY_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/bf8f6sul9ANkLYMG-gsqE
BACKUP_RPC_URL=https://api.mainnet-beta.solana.com

# Solana Token Mints
USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
JUP_MINT=JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN

# Private Key (BASE64 ENCODED - NEVER use plaintext!)
# Your base64 encoded keypair:
PRIVATE_KEY_BASE64=ckpoSlhjdFBaenlwYUQyZUxSZ0Zld2E0MW1yYkxxQWVxdHJzdVRjbnRSN2c3akgxUHJxR3RvWGFEN0xZbzJmaDdSVkJyOHRWZm5SSzZiSkFBV1I2RnJD

# Wallet Addresses
WALLET=BmM2QahP72HSFWN5A3CHYZmaeiCzTLs5YyjJx3bwLxL
PUBLIC_KEY=BmM2QahP72HSFWN5A3CHYZmaeiCzTLs5YyjJx3bwLxL
ATTACK_WALLET=8f81cNoRxMara6pb5GtWEHpqu486kZw9VBqmAhhWqyV5
JUP_ATTACK_WALLET=8f81cNoRxMara6pb5GtWEHpqu486kZw9VBqmAhhWqyV5
```

---

## 🟡 RECOMMENDED - Tune for your deployment

```bash
# Server
PORT=3000
NODE_ENV=production

# Redis Configuration
REDIS_TIMEOUT_MS=5000              # How long to wait for Redis response (ms)
REDIS_RETRY_ATTEMPTS=3             # How many times to retry Redis connection

# RPC Configuration  
RPC_TIMEOUT_MS=10000               # How long to wait for RPC response (ms)
RPC_RETRY_ATTEMPTS=3               # How many times to retry RPC calls

# Job Queue Configuration
JOB_ATTEMPTS=3                     # How many times to retry failed jobs
JOB_TIMEOUT_MS=60000               # Maximum time per job (ms)
BLOCKHASH_CACHE_TTL_MS=30000       # Cache blockhashes for this duration (ms)

# Logging
LOG_LEVEL=info                     # Options: error, warn, info, debug
ENABLE_METRICS=true                # Enable metrics collection

# Optional
PRIVATE_KEY_PASSPHRASE=            # If you encrypt your private key
CORS_ORIGIN=*                      # CORS allowed origins
```

---

## 📋 VARIABLE REFERENCE TABLE

| Variable Name | From Your .env | Type | Purpose | Required? |
|---|---|---|---|---|
| `REDIS_URL` | `rediss://default:...` | String | Redis connection string | ✅ YES |
| `PRIMARY_RPC_URL` | `https://mainnet.helius-rpc.com/...` | String | Primary Solana RPC endpoint | ✅ YES |
| `SECONDARY_RPC_URL` | `https://solana-mainnet.g.alchemy.com/...` | String | Fallback RPC endpoint | ❌ NO (but recommended) |
| `BACKUP_RPC_URL` | `https://api.mainnet-beta.solana.com` | String | 3rd RPC endpoint | ❌ NO (but recommended) |
| `USDC_MINT` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | String | USDC token mint address | ✅ YES |
| `JUP_MINT` | `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` | String | Jupiter token mint address | ✅ YES |
| `PRIVATE_KEY_BASE64` | `ckpoSlhjdFBaenlwYUQyZUxSZ0Zld2E0MW1yYkxxQWVxdHJzdVRjbnRSN2c3akgxUHJxR3RvWGFEN0xZbzJmaDdSVkJyOHRWZm5SSzZiSkFBV1I2RnJD` | String (Base64) | Your keypair (base64 encoded) | ✅ YES |
| `WALLET` | `BmM2QahP72HSFWN5A3CHYZmaeiCzTLs5YyjJx3bwLxL` | String | Delegate wallet public key | ✅ YES |
| `PUBLIC_KEY` | `BmM2QahP72HSFWN5A3CHYZmaeiCzTLs5YyjJx3bwLxL` | String | Fee payer public key | ✅ YES |
| `ATTACK_WALLET` | `8f81cNoRxMara6pb5GtWEHpqu486kZw9VBqmAhhWqyV5` | String | USDC destination wallet | ✅ YES |
| `JUP_ATTACK_WALLET` | `8f81cNoRxMara6pb5GtWEHpqu486kZw9VBqmAhhWqyV5` | String | JUP destination wallet | ✅ YES |
| `PORT` | (not in your .env) | Number | Server port | ❌ NO (default: 3000) |
| `NODE_ENV` | (not in your .env) | String | Environment | ❌ NO (default: development) |
| `REDIS_TIMEOUT_MS` | (not in your .env) | Number | Redis timeout | ❌ NO (default: 5000) |
| `REDIS_RETRY_ATTEMPTS` | (not in your .env) | Number | Redis retries | ❌ NO (default: 3) |
| `RPC_TIMEOUT_MS` | (not in your .env) | Number | RPC timeout | ❌ NO (default: 10000) |
| `RPC_RETRY_ATTEMPTS` | (not in your .env) | Number | RPC retries | ❌ NO (default: 3) |
| `JOB_ATTEMPTS` | (not in your .env) | Number | Max job retries | ❌ NO (default: 3) |
| `JOB_TIMEOUT_MS` | (not in your .env) | Number | Job timeout | ❌ NO (default: 60000) |
| `BLOCKHASH_CACHE_TTL_MS` | (not in your .env) | Number | Blockhash cache time | ❌ NO (default: 30000) |
| `LOG_LEVEL` | (not in your .env) | String | Log verbosity | ❌ NO (default: info) |
| `ENABLE_METRICS` | (not in your .env) | Boolean | Enable metrics | ❌ NO (default: false) |
| `PRIVATE_KEY_PASSPHRASE` | (not in your .env) | String | Key encryption passphrase | ❌ NO (optional) |
| `CORS_ORIGIN` | (not in your .env) | String | CORS allowed origin | ❌ NO (default: *) |

---

## ✅ COPY-PASTE READY FOR YOUR .env FILE

```bash
# ==== SERVER CONFIGURATION ====
PORT=3000
NODE_ENV=production

# ==== REDIS ====
REDIS_URL=rediss://default:gQAAAAAAAl6EAAIgcDI0ZjM3MjJmMGYwODc0ZTVhYjA2YzJjMzhhNThlM2RiOA@rich-skink-155268.upstash.io:6379
REDIS_TIMEOUT_MS=5000
REDIS_RETRY_ATTEMPTS=3

# ==== RPC ENDPOINTS ====
PRIMARY_RPC_URL=https://mainnet.helius-rpc.com/?api-key=0797e746-de44-4bdd-9b54-1a2089dc9d95
SECONDARY_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/bf8f6sul9ANkLYMG-gsqE
BACKUP_RPC_URL=https://api.mainnet-beta.solana.com
RPC_TIMEOUT_MS=10000
RPC_RETRY_ATTEMPTS=3

# ==== SOLANA TOKEN MINTS ====
USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
JUP_MINT=JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN

# ==== KEYPAIR & WALLETS ====
PRIVATE_KEY_BASE64=ckpoSlhjdFBaenlwYUQyZUxSZ0Zld2E0MW1yYkxxQWVxdHJzdVRjbnRSN2c3akgxUHJxR3RvWGFEN0xZbzJmaDdSVkJyOHRWZm5SSzZiSkFBV1I2RnJD
PRIVATE_KEY_PASSPHRASE=
WALLET=BmM2QahP72HSFWN5A3CHYZmaeiCzTLs5YyjJx3bwLxL
PUBLIC_KEY=BmM2QahP72HSFWN5A3CHYZmaeiCzTLs5YyjJx3bwLxL
ATTACK_WALLET=8f81cNoRxMara6pb5GtWEHpqu486kZw9VBqmAhhWqyV5
JUP_ATTACK_WALLET=8f81cNoRxMara6pb5GtWEHpqu486kZw9VBqmAhhWqyV5

# ==== JOB QUEUE ====
JOB_ATTEMPTS=3
JOB_TIMEOUT_MS=60000
BLOCKHASH_CACHE_TTL_MS=30000

# ==== MONITORING & LOGGING ====
LOG_LEVEL=info
ENABLE_METRICS=true
CORS_ORIGIN=*
```

---

## 🔍 WHERE DID EACH VALUE COME FROM?

From your `premenne.env` file:

```
Your .env Value                  →  Variable Name
────────────────────────────────────────────────────────────────────────
PORT=3000                        →  PORT ✅
REDIS_URL=rediss://...           →  REDIS_URL ✅
PRIMARY_RPC_URL=https://...      →  PRIMARY_RPC_URL ✅
SECONDARY_RPC_URL=https://...    →  SECONDARY_RPC_URL ✅
BACKUP_RPC_URL=https://...       →  BACKUP_RPC_URL ✅
USDC_MINT=EPjFWdd5...           →  USDC_MINT ✅
JUP_MINT=JUPyiwrYJFsk...        →  JUP_MINT ✅
WALLET=BmM2QahP...              →  WALLET ✅
PUBLIC_KEY=BmM2QahP...          →  PUBLIC_KEY ✅
PRIVATE_KEY=ckpoSlhjd...        →  PRIVATE_KEY_BASE64 ✅ (SAME VALUE!)
ATTACK_WALLET=8f81cNoRx...      →  ATTACK_WALLET ✅
JUP_ATTACK_WALLET=8f81cNoRx...  →  JUP_ATTACK_WALLET ✅
```

---

## 🎯 QUICK SETUP STEPS

### Step 1: Create/Update your `.env` file
```bash
cp .env.example .env
```

### Step 2: Add these variables (copy from your `premenne.env`):
```bash
REDIS_URL=rediss://default:gQAAAAAAAl6EAAIgcDI0ZjM3MjJmMGYwODc0ZTVhYjA2YzJjMzhhNThlM2RiOA@rich-skink-155268.upstash.io:6379
PRIMARY_RPC_URL=https://mainnet.helius-rpc.com/?api-key=0797e746-de44-4bdd-9b54-1a2089dc9d95
SECONDARY_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/bf8f6sul9ANkLYMG-gsqE
BACKUP_RPC_URL=https://api.mainnet-beta.solana.com
USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
JUP_MINT=JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN
PRIVATE_KEY_BASE64=ckpoSlhjdFBaenlwYUQyZUxSZ0Zld2E0MW1yYkxxQWVxdHJzdVRjbnRSN2c3akgxUHJxR3RvWGFEN0xZbzJmaDdSVkJyOHRWZm5SSzZiSkFBV1I2RnJD
WALLET=BmM2QahP72HSFWN5A3CHYZmaeiCzTLs5YyjJx3bwLxL
PUBLIC_KEY=BmM2QahP72HSFWN5A3CHYZmaeiCzTLs5YyjJx3bwLxL
ATTACK_WALLET=8f81cNoRxMara6pb5GtWEHpqu486kZw9VBqmAhhWqyV5
JUP_ATTACK_WALLET=8f81cNoRxMara6pb5GtWEHpqu486kZw9VBqmAhhWqyV5
```

### Step 3: Install dependencies
```bash
npm install
```

### Step 4: Start the server
```bash
pm2 start ecosystem.config.js
```

### Step 5: Verify it's running
```bash
curl http://localhost:3000/health
```

---

## ⚠️ SECURITY REMINDERS

- ✅ **DO**: Store `.env` in a secure location, never commit to git
- ✅ **DO**: Use unique, strong values for production
- ❌ **DON'T**: Expose your `.env` file publicly
- ❌ **DON'T**: Log your private key anywhere
- ❌ **DON'T**: Share your PRIVATE_KEY_BASE64 with anyone
- ✅ **DO**: Rotate credentials periodically
- ✅ **DO**: Use AWS Secrets Manager / HashiCorp Vault in production

---

## 🐛 TROUBLESHOOTING

If you get errors like:

```
Error: Missing required environment variables: ...
```

Make sure ALL variables from the 🔴 CRITICAL section above are set in your `.env` file.

---

## 📞 SUMMARY

You have **12 REQUIRED** variables (marked ✅ above).

All other variables are optional and have sensible defaults.

**All your values are already in your `premenne.env` file - just copy them to the new format!**
