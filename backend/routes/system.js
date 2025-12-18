import { Router } from "express";
import { cache, wrisCache, districtCache, getCacheStats } from "../utils/cache.js";
import { logMemoryUsage } from "../utils/performance.js";

const router = Router();

// Cache statistics endpoint
router.get("/cache/stats", (req, res) => {
  const stats = getCacheStats();
  
  res.json({
    timestamp: new Date().toISOString(),
    caches: {
      main: {
        ...stats.main,
        keys: cache.keys(),
      },
      wris: {
        ...stats.wris,
        keys: wrisCache.keys(),
      },
      district: {
        ...stats.district,
        keys: districtCache.keys(),
      },
    },
    summary: {
      totalKeys: cache.keys().length + wrisCache.keys().length + districtCache.keys().length,
      totalHits: stats.main.hits + stats.wris.hits + stats.district.hits,
      totalMisses: stats.main.misses + stats.wris.misses + stats.district.misses,
      hitRate: calculateHitRate(stats),
    },
  });
});

// Clear cache endpoint (protected - add auth middleware in production)
router.post("/cache/clear", (req, res) => {
  const { type } = req.body;
  
  let cleared = 0;
  
  if (!type || type === 'all') {
    cleared += cache.keys().length;
    cleared += wrisCache.keys().length;
    cleared += districtCache.keys().length;
    cache.flushAll();
    wrisCache.flushAll();
    districtCache.flushAll();
  } else if (type === 'main') {
    cleared = cache.keys().length;
    cache.flushAll();
  } else if (type === 'wris') {
    cleared = wrisCache.keys().length;
    wrisCache.flushAll();
  } else if (type === 'district') {
    cleared = districtCache.keys().length;
    districtCache.flushAll();
  } else {
    return res.status(400).json({ error: 'Invalid cache type' });
  }
  
  res.json({
    message: 'Cache cleared successfully',
    keysCleared: cleared,
    type: type || 'all',
  });
});

// System metrics endpoint
router.get("/metrics", async (req, res) => {
  const memUsage = process.memoryUsage();
  
  // Get circuit breaker stats
  let circuitBreakerStats = {};
  try {
    const { circuitBreaker } = await import('../utils/circuitBreaker.js');
    circuitBreakerStats = circuitBreaker.getStats();
  } catch (error) {
    console.error('Failed to get circuit breaker stats:', error);
  }
  
  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024 * 100) / 100} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100} MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100} MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024 * 100) / 100} MB`,
    },
    process: {
      pid: process.pid,
      version: process.version,
      platform: process.platform,
    },
    circuitBreaker: circuitBreakerStats,
  });
});

// Helper function
function calculateHitRate(stats) {
  const totalHits = stats.main.hits + stats.wris.hits + stats.district.hits;
  const totalMisses = stats.main.misses + stats.wris.misses + stats.district.misses;
  const total = totalHits + totalMisses;
  
  if (total === 0) return 0;
  return Math.round((totalHits / total) * 100 * 100) / 100;
}

export default router;
