/**
 * Performance Validation Tests
 * 
 * Measures prediction computation time with various data sizes to verify
 * the <100ms target is maintained and identify any performance bottlenecks.
 * 
 * Requirements: 4.1, 4.6, 4.7
 */

import { 
  computeFutureWaterLevels, 
  calculateConfidence,
  predictStressCategoryTransition,
  predictSeasonalLevels 
} from '../../utils/predictions.js';

// ============================================================================
// LINEAR REGRESSION HELPER
// ============================================================================

/**
 * Compute linear regression for historical data
 * @param {Array} history - Historical data [{date, waterLevel}]
 * @returns {Object} { slope, intercept, rSquared }
 */
function computeLinearRegression(history) {
  const n = history.length;
  
  // Convert dates to years from first date
  const firstDate = new Date(history[0].date);
  const x = history.map(record => {
    const date = new Date(record.date);
    return (date.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  });
  const y = history.map(record => record.waterLevel);
  
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  const denominator = x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0);
  
  if (denominator === 0) {
    return { slope: 0, intercept: meanY, rSquared: 0 };
  }
  
  const slope = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0) / denominator;
  const intercept = meanY - slope * meanX;
  
  // Calculate R-squared
  const fitted = x.map((xi) => slope * xi + intercept);
  const ssRes = y.reduce((sum, yi, i) => sum + (yi - fitted[i]) ** 2, 0);
  const ssTot = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0);
  const rSquared = ssTot === 0 ? 0 : Math.max(0, 1 - (ssRes / ssTot));
  
  return { slope, intercept, rSquared };
}

// ============================================================================
// PERFORMANCE MEASUREMENT UTILITIES
// ============================================================================

/**
 * Measure execution time of a function
 * @param {Function} fn - Function to measure
 * @returns {Object} { result, timeMs }
 */
function measureTime(fn) {
  const start = process.hrtime.bigint();
  const result = fn();
  const end = process.hrtime.bigint();
  const timeMs = Number(end - start) / 1_000_000; // Convert nanoseconds to milliseconds
  return { result, timeMs };
}

/**
 * Run multiple iterations and calculate statistics
 * @param {Function} fn - Function to measure
 * @param {number} iterations - Number of iterations
 * @returns {Object} { min, max, avg, median, p95, p99 }
 */
function benchmarkFunction(fn, iterations = 100) {
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const { timeMs } = measureTime(fn);
    times.push(timeMs);
  }
  
  times.sort((a, b) => a - b);
  
  const sum = times.reduce((acc, t) => acc + t, 0);
  const avg = sum / times.length;
  const median = times[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];
  
  return {
    min: times[0],
    max: times[times.length - 1],
    avg,
    median,
    p95,
    p99,
    iterations
  };
}

// ============================================================================
// TEST DATA GENERATORS
// ============================================================================

/**
 * Generate historical water level data
 * @param {number} count - Number of data points
 * @param {number} startYear - Starting year
 * @returns {Array} Historical data
 */
function generateHistoricalData(count, startYear = 2010) {
  const data = [];
  const baseLevel = 10.0;
  const annualDecline = 0.3;
  
  for (let i = 0; i < count; i++) {
    const date = new Date(startYear, 0, 1);
    date.setMonth(date.getMonth() + i * 3); // Every 3 months
    
    const waterLevel = baseLevel + (annualDecline * (i / 4)); // Quarterly decline
    
    data.push({
      date: date.toISOString().split('T')[0],
      waterLevel: Math.round(waterLevel * 100) / 100
    });
  }
  
  return data;
}

/**
 * Generate seasonal historical data
 * @param {number} years - Number of years
 * @returns {Array} Seasonal historical data
 */
function generateSeasonalData(years) {
  const data = [];
  const baseLevel = 10.0;
  const annualDecline = 0.3;
  const startYear = new Date().getFullYear() - years;
  
  for (let year = 0; year < years; year++) {
    // Pre-monsoon (March)
    data.push({
      date: `${startYear + year}-03-15`,
      waterLevel: baseLevel + (annualDecline * year) + 0.5 // Higher in pre-monsoon
    });
    
    // Post-monsoon (November)
    data.push({
      date: `${startYear + year}-11-15`,
      waterLevel: baseLevel + (annualDecline * year) // Lower after recharge
    });
  }
  
  return data;
}

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('Performance Validation - computeFutureWaterLevels', () => {
  const TARGET_MS = 100;
  
  test('Small dataset (10 points) - should be well under 100ms', () => {
    const history = generateHistoricalData(10);
    const { slope, intercept } = computeLinearRegression(history);
    const baseDate = new Date();
    
    const stats = benchmarkFunction(() => {
      computeFutureWaterLevels(history, slope, intercept, baseDate);
    }, 100);
    
    console.log('Small dataset (10 points):', stats);
    
    // All percentiles should be well under target
    expect(stats.avg).toBeLessThan(TARGET_MS);
    expect(stats.p95).toBeLessThan(TARGET_MS);
    expect(stats.p99).toBeLessThan(TARGET_MS);
  });
  
  test('Medium dataset (50 points) - should be under 100ms', () => {
    const history = generateHistoricalData(50);
    const { slope, intercept } = computeLinearRegression(history);
    const baseDate = new Date();
    
    const stats = benchmarkFunction(() => {
      computeFutureWaterLevels(history, slope, intercept, baseDate);
    }, 100);
    
    console.log('Medium dataset (50 points):', stats);
    
    expect(stats.avg).toBeLessThan(TARGET_MS);
    expect(stats.p95).toBeLessThan(TARGET_MS);
    expect(stats.p99).toBeLessThan(TARGET_MS);
  });
  
  test('Large dataset (200 points) - should be under 100ms', () => {
    const history = generateHistoricalData(200);
    const { slope, intercept } = computeLinearRegression(history);
    const baseDate = new Date();
    
    const stats = benchmarkFunction(() => {
      computeFutureWaterLevels(history, slope, intercept, baseDate);
    }, 100);
    
    console.log('Large dataset (200 points):', stats);
    
    expect(stats.avg).toBeLessThan(TARGET_MS);
    expect(stats.p95).toBeLessThan(TARGET_MS);
    expect(stats.p99).toBeLessThan(TARGET_MS);
  });
  
  test('Very large dataset (500 points) - should be under 100ms', () => {
    const history = generateHistoricalData(500);
    const { slope, intercept } = computeLinearRegression(history);
    const baseDate = new Date();
    
    const stats = benchmarkFunction(() => {
      computeFutureWaterLevels(history, slope, intercept, baseDate);
    }, 100);
    
    console.log('Very large dataset (500 points):', stats);
    
    expect(stats.avg).toBeLessThan(TARGET_MS);
    expect(stats.p95).toBeLessThan(TARGET_MS);
    expect(stats.p99).toBeLessThan(TARGET_MS);
  });
});

describe('Performance Validation - calculateConfidence', () => {
  const TARGET_MS = 100;
  
  test('Small dataset (10 points) - should be well under 100ms', () => {
    const history = generateHistoricalData(10);
    
    const stats = benchmarkFunction(() => {
      calculateConfidence(history, 0.75, 5);
    }, 100);
    
    console.log('calculateConfidence - Small dataset:', stats);
    
    expect(stats.avg).toBeLessThan(TARGET_MS);
    expect(stats.p99).toBeLessThan(TARGET_MS);
  });
  
  test('Large dataset (500 points) - should be under 100ms', () => {
    const history = generateHistoricalData(500);
    
    const stats = benchmarkFunction(() => {
      calculateConfidence(history, 0.75, 10);
    }, 100);
    
    console.log('calculateConfidence - Large dataset:', stats);
    
    expect(stats.avg).toBeLessThan(TARGET_MS);
    expect(stats.p99).toBeLessThan(TARGET_MS);
  });
});

describe('Performance Validation - predictStressCategoryTransition', () => {
  const TARGET_MS = 100;
  
  test('Stress transition calculation - should be well under 100ms', () => {
    const stats = benchmarkFunction(() => {
      predictStressCategoryTransition('Safe', 0.15, 12.5);
    }, 100);
    
    console.log('predictStressCategoryTransition:', stats);
    
    // This function should be very fast (no loops)
    expect(stats.avg).toBeLessThan(TARGET_MS);
    expect(stats.p99).toBeLessThan(TARGET_MS);
  });
});

describe('Performance Validation - predictSeasonalLevels', () => {
  const TARGET_MS = 100;
  
  test('Small seasonal dataset (5 years) - should be under 100ms', () => {
    const history = generateSeasonalData(5);
    const currentDate = new Date();
    const slope = -0.3;
    
    const stats = benchmarkFunction(() => {
      predictSeasonalLevels(history, currentDate, slope);
    }, 100);
    
    console.log('Seasonal prediction - 5 years:', stats);
    
    expect(stats.avg).toBeLessThan(TARGET_MS);
    expect(stats.p95).toBeLessThan(TARGET_MS);
    expect(stats.p99).toBeLessThan(TARGET_MS);
  });
  
  test('Medium seasonal dataset (10 years) - should be under 100ms', () => {
    const history = generateSeasonalData(10);
    const currentDate = new Date();
    const slope = -0.3;
    
    const stats = benchmarkFunction(() => {
      predictSeasonalLevels(history, currentDate, slope);
    }, 100);
    
    console.log('Seasonal prediction - 10 years:', stats);
    
    expect(stats.avg).toBeLessThan(TARGET_MS);
    expect(stats.p95).toBeLessThan(TARGET_MS);
    expect(stats.p99).toBeLessThan(TARGET_MS);
  });
  
  test('Large seasonal dataset (20 years) - should be under 100ms', () => {
    const history = generateSeasonalData(20);
    const currentDate = new Date();
    const slope = -0.3;
    
    const stats = benchmarkFunction(() => {
      predictSeasonalLevels(history, currentDate, slope);
    }, 100);
    
    console.log('Seasonal prediction - 20 years:', stats);
    
    expect(stats.avg).toBeLessThan(TARGET_MS);
    expect(stats.p95).toBeLessThan(TARGET_MS);
    expect(stats.p99).toBeLessThan(TARGET_MS);
  });
});

describe('Performance Validation - Full Prediction Pipeline', () => {
  const TARGET_MS = 100;
  
  test('Complete prediction workflow - should be under 100ms', () => {
    const history = generateHistoricalData(100);
    const currentDate = new Date();
    
    const stats = benchmarkFunction(() => {
      // Simulate full prediction pipeline
      const { slope, intercept, rSquared } = computeLinearRegression(history);
      const baseDate = new Date();
      
      // Future predictions
      computeFutureWaterLevels(history, slope, intercept, baseDate);
      
      // Confidence calculation
      const dataSpanYears = 10;
      calculateConfidence(history, rSquared, dataSpanYears);
      
      // Stress transition
      predictStressCategoryTransition('Safe', Math.abs(slope), 12.5);
      
      // Seasonal predictions
      const seasonalHistory = generateSeasonalData(10);
      predictSeasonalLevels(seasonalHistory, currentDate, slope);
    }, 50); // Fewer iterations for full pipeline
    
    console.log('Full prediction pipeline:', stats);
    
    // Full pipeline should still be under target
    expect(stats.avg).toBeLessThan(TARGET_MS);
    expect(stats.p95).toBeLessThan(TARGET_MS);
  });
});

describe('Performance Validation - Bottleneck Identification', () => {
  test('Profile individual operations in predictSeasonalLevels', () => {
    const history = generateSeasonalData(10);
    const currentDate = new Date();
    const slope = -0.3;
    
    // Measure each major operation
    const operations = {};
    
    // Full function
    const fullTime = measureTime(() => {
      predictSeasonalLevels(history, currentDate, slope);
    });
    operations.full = fullTime.timeMs;
    
    console.log('\nOperation breakdown for predictSeasonalLevels:');
    console.log(`  Full function: ${operations.full.toFixed(3)}ms`);
    
    // All operations should be fast
    expect(operations.full).toBeLessThan(100);
  });
  
  test('Profile individual operations in computeFutureWaterLevels', () => {
    const history = generateHistoricalData(100);
    const { slope, intercept } = computeLinearRegression(history);
    const baseDate = new Date();
    
    const operations = {};
    
    // Full function
    const fullTime = measureTime(() => {
      computeFutureWaterLevels(history, slope, intercept, baseDate);
    });
    operations.full = fullTime.timeMs;
    
    console.log('\nOperation breakdown for computeFutureWaterLevels:');
    console.log(`  Full function: ${operations.full.toFixed(3)}ms`);
    
    expect(operations.full).toBeLessThan(100);
  });
});

describe('Performance Validation - Memory Usage', () => {
  test('Large dataset should not cause memory issues', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Process large dataset
    const history = generateHistoricalData(1000);
    const { slope, intercept } = computeLinearRegression(history);
    const baseDate = new Date();
    
    for (let i = 0; i < 100; i++) {
      computeFutureWaterLevels(history, slope, intercept, baseDate);
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncreaseMB = (finalMemory - initialMemory) / (1024 * 1024);
    
    console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
    
    // Memory increase should be reasonable (< 50MB)
    expect(memoryIncreaseMB).toBeLessThan(50);
  });
});
