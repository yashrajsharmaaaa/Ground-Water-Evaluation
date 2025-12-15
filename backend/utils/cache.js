import NodeCache from "node-cache";

// Enhanced cache with different TTLs for different data types
// General cache: 1 hour TTL, check every 10 minutes
export const cache = new NodeCache({ 
  stdTTL: 3600,
  checkperiod: 600,
  useClones: false,
});

// WRIS API cache: 2 hour TTL (external API data changes slowly)
export const wrisCache = new NodeCache({ 
  stdTTL: 7200,
  checkperiod: 600,
  useClones: false,
});

// District lookup cache: 24 hour TTL (static geographic data)
export const districtCache = new NodeCache({ 
  stdTTL: 86400,
  checkperiod: 3600,
  useClones: false,
});

// Generate deterministic cache key by sorting params (ensures consistency)
export const generateCacheKey = (prefix, params) => {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  return `${prefix}:${sortedParams}`;
};

// Cache statistics
export const getCacheStats = () => ({
  main: cache.getStats(),
  wris: wrisCache.getStats(),
  district: districtCache.getStats(),
});