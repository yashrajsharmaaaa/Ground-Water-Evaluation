/**
 * Performance validation tests for prediction computations
 * 
 * Task 13: Performance validation
 * - Measure prediction computation time with various data sizes
 * - Verify <100ms overhead target is met
 * - Test with 10, 50, 100, 500 data points
 * - Profile for potential bottlenecks
 * 
 * Requirement 6.1: Predictions SHALL complete calculations within 100 milliseconds
 */

import { describe, test, expect } from '@jest/globals';
import { 
  computeFutureWaterLevels, 
  predictStressCategoryTransition, 
  predictSeasonalLevels,
  calculateConfidence 
} from '../../utils/predictions.js';

// Helper to create test history data with specified size
const createHistory = (count, startYear = 2015) => {
  return Array.from({ length: count }, (_, i) => ({
    date: new Date(startYear, 0, 1 + i * Math.floor(365 / count)),
    waterLevel: 10 + i * 0.5 + Math.random() * 0.1 // Add slight variation
  }));
};

// Helper to create seasonal history data
const createSeasonalHistory = (years) => {
  const history = [];
  years.forEach(year => {
    // Pre-monsoon data (March)
    history.push({
      date: new Date(year, 2, 15),
      waterLevel: 12 + Math.random() * 2
    });
    // Post-monsoon data (November)
    history.push({
      date: new Date(year, 10, 15),
      waterLevel: 10 + Math.random() * 2
    });
  });
  return history;
};

// Helper to measure execution time
const measureExecutionTime = (fn) => {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  const duration = end - start;
  return { result, duration };
};

// Helper to run multiple iterations and get average time
const measureAverageTime = (fn, iterations = 10) => {
  const times = [];
  let result = null;
  
  for (let i = 0; i < iterations; i++) {
    const { result: r, duration } = measureExecutionTime(fn);
    times.push(duration);
    result = r;
  }
  
  const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  return { avgTime, minTime, maxTime, result };
};

describe('Performance Validation - computeFutureWaterLevels', () => {
  const baseDate = new Date('2024-12-15');
  const slope = 0.5;
  const intercept = 10;

  test('PERFORMANCE: 10 data points - should complete within 100ms', () => {
    const history = createHistory(10);
    
    const { avgTime, minTime, maxTime } = measureAverageTime(() => {
      return computeFutureWaterLevels(history, slope, intercept, baseDate);
    }, 20);
    
    console.log(`  📊 10 points: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
    
    // Requirement 6.1: Should complete within 100ms
    expect(avgTime).toBeLessThan(100);
    expect(maxTime).toBeLessThan(100);
  });

  test('PERFORMANCE: 50 data points - should complete within 100ms', () => {
    const history = createHistory(50);
    
    const { avgTime, minTime, maxTime } = measureAverageTime(() => {
      return computeFutureWaterLevels(history, slope, intercept, baseDate);
    }, 20);
    
    console.log(`  📊 50 points: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
    
    // Requirement 6.1: Should complete within 100ms
    expect(avgTime).toBeLessThan(100);
    expect(maxTime).toBeLessThan(100);
  });

  test('PERFORMANCE: 100 data points - should complete within 100ms', () => {
    const history = createHistory(100);
    
    const { avgTime, minTime, maxTime } = measureAverageTime(() => {
      return computeFutureWaterLevels(history, slope, intercept, baseDate);
    }, 20);
    
    console.log(`  📊 100 points: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
    
    // Requirement 6.1: Should complete within 100ms
    expect(avgTime).toBeLessThan(100);
    expect(maxTime).toBeLessThan(100);
  });

  test('PERFORMANCE: 500 data points - should complete within 100ms', () => {
    const history = createHistory(500);
    
    const { avgTime, minTime, maxTime } = measureAverageTime(() => {
      return computeFutureWaterLevels(history, slope, intercept, baseDate);
    }, 20);
    
    console.log(`  📊 500 points: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
    
    // Requirement 6.1: Should complete within 100ms
    expect(avgTime).toBeLessThan(100);
    expect(maxTime).toBeLessThan(100);
  });

  test('PERFORMANCE: Verify linear scaling with data size', () => {
    const sizes = [10, 50, 100, 500];
    const timings = [];
    
    sizes.forEach(size => {
      const history = createHistory(size);
      const { avgTime } = measureAverageTime(() => {
        return computeFutureWaterLevels(history, slope, intercept, baseDate);
      }, 10);
      timings.push({ size, avgTime });
    });
    
    console.log('  📈 Scaling analysis:');
    timings.forEach(({ size, avgTime }) => {
      console.log(`     ${size} points: ${avgTime.toFixed(2)}ms`);
    });
    
    // Verify that time doesn't grow exponentially
    // Time for 500 points should be less than 10x time for 50 points
    const time50 = timings.find(t => t.size === 50).avgTime;
    const time500 = timings.find(t => t.size === 500).avgTime;
    const scalingFactor = time500 / time50;
    
    console.log(`     Scaling factor (500/50): ${scalingFactor.toFixed(2)}x`);
    
    // Should scale reasonably (not exponentially)
    expect(scalingFactor).toBeLessThan(10);
  });
});

describe('Performance Validation - predictStressCategoryTransition', () => {
  test('PERFORMANCE: Stress category prediction - should complete within 100ms', () => {
    const { avgTime, minTime, maxTime } = measureAverageTime(() => {
      return predictStressCategoryTransition('Safe', 0.08, 10);
    }, 50);
    
    console.log(`  📊 Stress prediction: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
    
    // Requirement 6.1: Should complete within 100ms
    expect(avgTime).toBeLessThan(100);
    expect(maxTime).toBeLessThan(100);
  });

  test('PERFORMANCE: Multiple stress category predictions in sequence', () => {
    const categories = ['Safe', 'Semi-critical', 'Critical', 'Over-exploited'];
    const declineRates = [0.05, 0.3, 0.7, 1.5];
    
    const start = performance.now();
    
    categories.forEach((category, i) => {
      predictStressCategoryTransition(category, declineRates[i], 10 + i * 5);
    });
    
    const end = performance.now();
    const totalTime = end - start;
    const avgTimePerPrediction = totalTime / categories.length;
    
    console.log(`  📊 4 sequential predictions: total=${totalTime.toFixed(2)}ms, avg=${avgTimePerPrediction.toFixed(2)}ms`);
    
    // Each prediction should be fast
    expect(avgTimePerPrediction).toBeLessThan(100);
  });
});

describe('Performance Validation - predictSeasonalLevels', () => {
  test('PERFORMANCE: Seasonal prediction with 5 years of data - should complete within 100ms', () => {
    const history = createSeasonalHistory([2019, 2020, 2021, 2022, 2023]);
    const currentDate = new Date('2024-01-15');
    
    const { avgTime, minTime, maxTime } = measureAverageTime(() => {
      return predictSeasonalLevels(history, currentDate, 0.5);
    }, 20);
    
    console.log(`  📊 5 years seasonal: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
    
    // Requirement 6.1: Should complete within 100ms
    expect(avgTime).toBeLessThan(100);
    expect(maxTime).toBeLessThan(100);
  });

  test('PERFORMANCE: Seasonal prediction with 10 years of data - should complete within 100ms', () => {
    const years = Array.from({ length: 10 }, (_, i) => 2014 + i);
    const history = createSeasonalHistory(years);
    const currentDate = new Date('2024-01-15');
    
    const { avgTime, minTime, maxTime } = measureAverageTime(() => {
      return predictSeasonalLevels(history, currentDate, 0.5);
    }, 20);
    
    console.log(`  📊 10 years seasonal: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
    
    // Requirement 6.1: Should complete within 100ms
    expect(avgTime).toBeLessThan(100);
    expect(maxTime).toBeLessThan(100);
  });

  test('PERFORMANCE: Seasonal prediction with 20 years of data - should complete within 100ms', () => {
    const years = Array.from({ length: 20 }, (_, i) => 2004 + i);
    const history = createSeasonalHistory(years);
    const currentDate = new Date('2024-01-15');
    
    const { avgTime, minTime, maxTime } = measureAverageTime(() => {
      return predictSeasonalLevels(history, currentDate, 0.5);
    }, 20);
    
    console.log(`  📊 20 years seasonal: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
    
    // Requirement 6.1: Should complete within 100ms
    expect(avgTime).toBeLessThan(100);
    expect(maxTime).toBeLessThan(100);
  });
});

describe('Performance Validation - calculateConfidence', () => {
  test('PERFORMANCE: Confidence calculation with 10 data points - should complete within 100ms', () => {
    const history = createHistory(10);
    
    const { avgTime, minTime, maxTime } = measureAverageTime(() => {
      return calculateConfidence(history, 0.85, 10);
    }, 50);
    
    console.log(`  📊 10 points confidence: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
    
    // Requirement 6.1: Should complete within 100ms
    expect(avgTime).toBeLessThan(100);
    expect(maxTime).toBeLessThan(100);
  });

  test('PERFORMANCE: Confidence calculation with 500 data points - should complete within 100ms', () => {
    const history = createHistory(500);
    
    const { avgTime, minTime, maxTime } = measureAverageTime(() => {
      return calculateConfidence(history, 0.85, 10);
    }, 50);
    
    console.log(`  📊 500 points confidence: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
    
    // Requirement 6.1: Should complete within 100ms
    expect(avgTime).toBeLessThan(100);
    expect(maxTime).toBeLessThan(100);
  });
});

describe('Performance Validation - Combined Operations', () => {
  test('PERFORMANCE: All three prediction types together - should complete within 100ms', () => {
    const history = createHistory(100);
    const seasonalHistory = createSeasonalHistory([2019, 2020, 2021, 2022, 2023]);
    const baseDate = new Date('2024-12-15');
    const currentDate = new Date('2024-01-15');
    
    const { avgTime, minTime, maxTime } = measureAverageTime(() => {
      // Simulate what happens in the actual API route
      const future = computeFutureWaterLevels(history, 0.5, 10, baseDate);
      const stress = predictStressCategoryTransition('Safe', 0.08, 10);
      const seasonal = predictSeasonalLevels(seasonalHistory, currentDate, 0.5);
      const confidence = calculateConfidence(history, 0.85, 10);
      
      return { future, stress, seasonal, confidence };
    }, 20);
    
    console.log(`  📊 Combined operations: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
    
    // Requirement 6.1: Combined operations should complete within 100ms
    expect(avgTime).toBeLessThan(100);
    expect(maxTime).toBeLessThan(100);
  });

  test('PERFORMANCE: Combined operations with large dataset (500 points) - should complete within 100ms', () => {
    const history = createHistory(500);
    const years = Array.from({ length: 20 }, (_, i) => 2004 + i);
    const seasonalHistory = createSeasonalHistory(years);
    const baseDate = new Date('2024-12-15');
    const currentDate = new Date('2024-01-15');
    
    const { avgTime, minTime, maxTime } = measureAverageTime(() => {
      const future = computeFutureWaterLevels(history, 0.5, 10, baseDate);
      const stress = predictStressCategoryTransition('Safe', 0.08, 10);
      const seasonal = predictSeasonalLevels(seasonalHistory, currentDate, 0.5);
      const confidence = calculateConfidence(history, 0.85, 10);
      
      return { future, stress, seasonal, confidence };
    }, 20);
    
    console.log(`  📊 Combined (500 points): avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
    
    // Requirement 6.1: Even with large dataset, should complete within 100ms
    expect(avgTime).toBeLessThan(100);
    expect(maxTime).toBeLessThan(100);
  });
});

describe('Performance Validation - Bottleneck Analysis', () => {
  test('PROFILE: Identify slowest operation in prediction pipeline', () => {
    const history = createHistory(100);
    const seasonalHistory = createSeasonalHistory([2019, 2020, 2021, 2022, 2023]);
    const baseDate = new Date('2024-12-15');
    const currentDate = new Date('2024-01-15');
    
    // Measure each operation individually
    const operations = [
      {
        name: 'Future Water Levels',
        fn: () => computeFutureWaterLevels(history, 0.5, 10, baseDate)
      },
      {
        name: 'Stress Category',
        fn: () => predictStressCategoryTransition('Safe', 0.08, 10)
      },
      {
        name: 'Seasonal Predictions',
        fn: () => predictSeasonalLevels(seasonalHistory, currentDate, 0.5)
      },
      {
        name: 'Confidence Calculation',
        fn: () => calculateConfidence(history, 0.85, 10)
      }
    ];
    
    console.log('  🔍 Bottleneck analysis:');
    
    const timings = operations.map(({ name, fn }) => {
      const { avgTime } = measureAverageTime(fn, 30);
      console.log(`     ${name}: ${avgTime.toFixed(2)}ms`);
      return { name, avgTime };
    });
    
    // Find slowest operation
    const slowest = timings.reduce((max, current) => 
      current.avgTime > max.avgTime ? current : max
    );
    
    console.log(`     Slowest: ${slowest.name} (${slowest.avgTime.toFixed(2)}ms)`);
    
    // Even the slowest operation should be well under 100ms
    expect(slowest.avgTime).toBeLessThan(100);
    
    // Total time should be sum of individual operations
    const totalTime = timings.reduce((sum, { avgTime }) => sum + avgTime, 0);
    console.log(`     Total sequential: ${totalTime.toFixed(2)}ms`);
    
    // Total should still be under 100ms
    expect(totalTime).toBeLessThan(100);
  });

  test('PROFILE: Data validation overhead', () => {
    const history = createHistory(100);
    const baseDate = new Date('2024-12-15');
    
    // Measure time with validation (normal path)
    const { avgTime: withValidation } = measureAverageTime(() => {
      return computeFutureWaterLevels(history, 0.5, 10, baseDate);
    }, 30);
    
    console.log(`  🔍 Validation overhead:`);
    console.log(`     With validation: ${withValidation.toFixed(2)}ms`);
    
    // Validation overhead should be minimal
    expect(withValidation).toBeLessThan(100);
  });

  test('PROFILE: Impact of invalid data filtering', () => {
    // Create history with some invalid data
    const validHistory = createHistory(80);
    const invalidRecords = Array.from({ length: 20 }, (_, i) => ({
      date: new Date(2024, 0, i + 1),
      waterLevel: i % 2 === 0 ? null : NaN // Mix of null and NaN
    }));
    const mixedHistory = [...validHistory, ...invalidRecords];
    
    const baseDate = new Date('2024-12-15');
    
    const { avgTime } = measureAverageTime(() => {
      return computeFutureWaterLevels(mixedHistory, 0.5, 10, baseDate);
    }, 20);
    
    console.log(`  🔍 Invalid data filtering:`);
    console.log(`     100 records (20% invalid): ${avgTime.toFixed(2)}ms`);
    
    // Filtering should not significantly impact performance
    expect(avgTime).toBeLessThan(100);
  });
});

describe('Performance Validation - Memory and Concurrency', () => {
  test('PERFORMANCE: Multiple concurrent predictions (simulated)', () => {
    const histories = Array.from({ length: 10 }, (_, i) => createHistory(100 + i * 10));
    const baseDate = new Date('2024-12-15');
    
    const start = performance.now();
    
    // Simulate concurrent predictions (in reality these would be async)
    const results = histories.map(history => {
      return computeFutureWaterLevels(history, 0.5, 10, baseDate);
    });
    
    const end = performance.now();
    const totalTime = end - start;
    const avgTimePerPrediction = totalTime / histories.length;
    
    console.log(`  📊 10 predictions: total=${totalTime.toFixed(2)}ms, avg=${avgTimePerPrediction.toFixed(2)}ms`);
    
    // Each prediction should still be fast
    expect(avgTimePerPrediction).toBeLessThan(100);
    
    // All results should be valid
    expect(results).toHaveLength(10);
    results.forEach(result => {
      expect(result.predictions).toHaveLength(4);
    });
  });

  test('PERFORMANCE: Large dataset memory efficiency', () => {
    // Create a very large dataset
    const largeHistory = createHistory(1000);
    const baseDate = new Date('2024-12-15');
    
    const { avgTime, result } = measureAverageTime(() => {
      return computeFutureWaterLevels(largeHistory, 0.5, 10, baseDate);
    }, 10);
    
    console.log(`  📊 1000 points: ${avgTime.toFixed(2)}ms`);
    
    // Should still complete within 100ms even with 1000 points
    expect(avgTime).toBeLessThan(100);
    
    // Result should be valid
    expect(result.predictions).toHaveLength(4);
  });
});

describe('Performance Validation - Summary Report', () => {
  test('SUMMARY: Generate performance report for all operations', () => {
    console.log('\n  📋 PERFORMANCE SUMMARY REPORT');
    console.log('  ═══════════════════════════════════════════════════════════');
    
    const testCases = [
      {
        name: 'Future Predictions (10 pts)',
        fn: () => computeFutureWaterLevels(createHistory(10), 0.5, 10, new Date('2024-12-15'))
      },
      {
        name: 'Future Predictions (50 pts)',
        fn: () => computeFutureWaterLevels(createHistory(50), 0.5, 10, new Date('2024-12-15'))
      },
      {
        name: 'Future Predictions (100 pts)',
        fn: () => computeFutureWaterLevels(createHistory(100), 0.5, 10, new Date('2024-12-15'))
      },
      {
        name: 'Future Predictions (500 pts)',
        fn: () => computeFutureWaterLevels(createHistory(500), 0.5, 10, new Date('2024-12-15'))
      },
      {
        name: 'Stress Category Prediction',
        fn: () => predictStressCategoryTransition('Safe', 0.08, 10)
      },
      {
        name: 'Seasonal Predictions (5 yrs)',
        fn: () => predictSeasonalLevels(createSeasonalHistory([2019, 2020, 2021, 2022, 2023]), new Date('2024-01-15'), 0.5)
      },
      {
        name: 'Confidence Calculation',
        fn: () => calculateConfidence(createHistory(100), 0.85, 10)
      },
      {
        name: 'Combined Operations',
        fn: () => {
          const history = createHistory(100);
          const seasonalHistory = createSeasonalHistory([2019, 2020, 2021, 2022, 2023]);
          computeFutureWaterLevels(history, 0.5, 10, new Date('2024-12-15'));
          predictStressCategoryTransition('Safe', 0.08, 10);
          predictSeasonalLevels(seasonalHistory, new Date('2024-01-15'), 0.5);
          calculateConfidence(history, 0.85, 10);
        }
      }
    ];
    
    let allPassed = true;
    
    testCases.forEach(({ name, fn }) => {
      const { avgTime, maxTime } = measureAverageTime(fn, 20);
      const passed = maxTime < 100;
      const status = passed ? '✅ PASS' : '❌ FAIL';
      
      console.log(`  ${status} ${name.padEnd(35)} avg: ${avgTime.toFixed(2)}ms  max: ${maxTime.toFixed(2)}ms`);
      
      if (!passed) allPassed = false;
    });
    
    console.log('  ═══════════════════════════════════════════════════════════');
    console.log(`  Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log(`  Target: <100ms per operation (Requirement 6.1)`);
    console.log('  ═══════════════════════════════════════════════════════════\n');
    
    // All operations should pass the 100ms requirement
    expect(allPassed).toBe(true);
  });
});
