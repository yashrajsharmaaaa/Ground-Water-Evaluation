import NodeCache from "node-cache";

// Enhanced cache with different TTLs for different data types
export const cache = new NodeCache({ 
  stdTTL: 3600,
  checkperiod: 600,
  useClones: false,
});

// Specialized caches
export const wrisCache = new NodeCache({ 
  stdTTL: 7200,
  checkperiod: 600,
  useClones: false,
});

export const districtCache = new NodeCache({ 
  stdTTL: 86400,
  checkperiod: 3600,
  useClones: false,
});

// Cache key generators
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