/**
 * Performance monitoring utilities
 */

// Request timing middleware
export const requestTimer = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = duration > 1000 ? '⚠️' : duration > 500 ? '⏱️' : '✅';
    console.log(`${logLevel} ${req.method} ${req.path} - ${duration}ms`);
  });
  
  next();
};

// Memory usage monitor
export const logMemoryUsage = () => {
  const used = process.memoryUsage();
  console.log('💾 Memory Usage:');
  for (let key in used) {
    console.log(`  ${key}: ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
  }
};

// Performance metrics
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  start(label) {
    this.metrics.set(label, Date.now());
  }

  end(label) {
    const start = this.metrics.get(label);
    if (!start) {
      console.warn(`No start time found for label: ${label}`);
      return 0;
    }
    
    const duration = Date.now() - start;
    this.metrics.delete(label);
    return duration;
  }

  measure(label, fn) {
    this.start(label);
    const result = fn();
    const duration = this.end(label);
    console.log(`⏱️ ${label}: ${duration}ms`);
    return result;
  }

  async measureAsync(label, fn) {
    this.start(label);
    const result = await fn();
    const duration = this.end(label);
    console.log(`⏱️ ${label}: ${duration}ms`);
    return result;
  }
}

export const perfMonitor = new PerformanceMonitor();

// Batch processing utility
export const batchProcess = async (items, batchSize, processor) => {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  
  return results;
};

// Memoization utility
export const memoize = (fn, keyGenerator = (...args) => JSON.stringify(args)) => {
  const cache = new Map();
  
  return (...args) => {
    const key = keyGenerator(...args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};
