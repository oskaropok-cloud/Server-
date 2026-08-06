const https = require("https");
const logger = require("../core/logger");
const { getConfig } = require("../config/environment");

// Cache for mapping and prices
let mintToIdMap = null;
let mapFetchedAt = 0;
const MAP_TTL = 24 * 60 * 60 * 1000; // 24h

const COINGECKO_API_PRICE = "https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=";
const COINGECKO_API_LIST = "https://api.coingecko.com/api/v3/coins/list?include_platform=true";

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", (err) => reject(err));
  });
}

async function ensureMapping() {
  const now = Date.now();
  if (mintToIdMap && (now - mapFetchedAt) < MAP_TTL) return;

  try {
    const list = await fetchJson(COINGECKO_API_LIST);
    const map = Object.create(null);
    for (const coin of list || []) {
      if (coin.platforms && coin.platforms.solana) {
        const addr = coin.platforms.solana;
        if (addr && typeof addr === "string") {
          map[addr] = coin.id;
        }
      }
    }
    // Always include native SOL mapping
    map["So11111111111111111111111111111111111111112"] = "solana";
    mintToIdMap = map;
    mapFetchedAt = Date.now();
    logger.info("priceService: Coingecko mapping fetched", { entries: Object.keys(map).length });
  } catch (err) {
    logger.warn("priceService: failed to fetch Coingecko coins list", { error: err.message });
    // leave existing mapping if present
    if (!mintToIdMap) mintToIdMap = {};
  }
}

async function getTokenPriceUSD(mint) {
  try {
    await ensureMapping();
    const id = mintToIdMap && mintToIdMap[mint];
    if (!id) return null;
    const url = `${COINGECKO_API_PRICE}${encodeURIComponent(id)}`;
    const json = await fetchJson(url);
    if (!json || !json[id] || typeof json[id].usd !== "number") return null;
    return json[id].usd;
  } catch (err) {
    logger.warn("priceService:getTokenPriceUSD failed", { mint, error: err.message });
    return null;
  }
}

module.exports = { getTokenPriceUSD };
