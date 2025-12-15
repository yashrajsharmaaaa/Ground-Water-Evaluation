/**
 * Edge Case Tests for Predictions Module
 * Task 17: Add missing edge case tests
 * 
 * Tests minimum thresholds, boundaries, and special conditions
 * Requirements: 6.1, 6.3
 */

import { describe, test, expect } from '@jest/globals';
import { 
  computeFutureWaterLevels, 
  predictStressCategoryTransition, 
  predictSeasonalLevels 
} from '../../utils/predictions.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create test history data with specified number of records
 */
const createHistory = (count, startYear = 2015) => {
  return Array.from({ length: count }, (_, i) => ({
    date: new Date(startYear + i, 0, 1),
    waterLevel: 10 + i * 0.5
  }));
};

/**
 * Create seasonal history with complete cycles for specified years
 */
const createSeasonalHistory = (years) => {
  const history = [];
  years.forEach(year => {
    // Pre-monsoon data (March)
    history.push({
      date: new Date(year, 2, 15), // March 15
      waterLevel: 12 + Math.random() * 2
    });
    // Post-monsoon data (November)
    history.push({
      date: new Date(year, 10, 15), // November 15
      waterLevel: 10 + Math.random() * 2
    });
  });
  return history;
};

// ============================================================================
// EDGE CASE: EXACTLY 3 DATA POINTS (MINIMUM THRESHOLD)
// Requirement 6.1, 6.3
// ============================================================================

describe('Edge Case: Exactly 3 Data Points (Minimum Threshold)', () => {
  
  test('computeFutureWaterLevels succeeds with exactly 3 data points', () => {
    const history = createHistory(3);
    const baseDate = new Date('2024-12-15');
    
    // Should succeed with exactly 3 points (minimum threshold)
    const result = computeFutureWaterLevels(history, 0.5, 10, baseDate);
    
    expect(result.predictions).toHaveLength(4);
    expect(result.predictions.map(p => p.year)).toEqual([1, 2, 3, 5]);
    expect(result.methodology).toContain('3-point');
  });
  
  test('computeFutureWaterLevels fails with 2 data points (below minimum)', () => {
    const history = createHistory(2);
    const baseDate = new Date('2024-12-15');
    
    // Should throw error with fewer than 3 points
    expect(() => computeFutureWaterLevels(history, 0.5, 10, baseDate))
      .toThrow(/Insufficient data points/);
  });
  
  test('computeFutureWaterLevels fails with 1 data point', () => {
    const history = createHistory(1);
    const baseDate = new Date('2024-12-15');
    
    expect(() => computeFutureWaterLevels(history, 0.5, 10, baseDate))
      .toThrow(/Insufficient data points/);
  });
  
  test('computeFutureWaterLevels fails with 0 data points', () => {
    const history = [];
    const baseDate = new Date('2024-12-15');
    
    expect(() => computeFutureWaterLevels(history, 0.5, 10, baseDate))
      .toThrow(/Insufficient data points/);
  });
});

// ============================================================================
// EDGE CASE: EXACTLY 3 SEASONAL CYCLES (MINIMUM THRESHOLD)
// Requirement 6.1, 6.3
// ============================================================================

describe('Edge Case: Exactly 3 Seasonal Cycles (Minimum Threshold)', () => {
  
  test('predictSeasonalLevels succeeds with exactly 3 complete cycles', () => {
    const history = createSeasonalHistory([2021, 2022, 2023]);
    const currentDate = new Date('2024-01-15');
    
    // Should succeed with exactly 3 complete cycles (minimum threshold)
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    expect(result.nextSeason).toBeDefined();
    expect(result.followingSeason).toBeDefined();
    expect(result.methodology).toContain('5-year seasonal average');
  });
  
  test('predictSeasonalLevels fails with 2 complete cycles (below minimum)', () => {
    const history = createSeasonalHistory([2022, 2023]);
    const currentDate = new Date('2024-01-15');
    
    // Should throw error with fewer than 3 complete cycles
    expect(() => predictSeasonalLevels(history, currentDate, 0.5))
      .toThrow(/Insufficient seasonal data.*Found 2 complete seasonal cycle/);
  });
  
  test('predictSeasonalLevels fails with 1 complete cycle', () => {
    const history = createSeasonalHistory([2023]);
    const currentDate = new Date('2024-01-15');
    
    // With only 1 year, we have 2 data points (pre and post monsoon)
    // This fails the minimum data points check (3 required) before seasonal cycle check
    expect(() => predictSeasonalLevels(history, currentDate, 0.5))
      .toThrow(/Insufficient data points.*Found 2 record/);
  });
  
  test('predictSeasonalLevels fails with incomplete cycles (only pre-monsoon)', () => {
    const history = [
      { date: new Date(2021, 2, 15), waterLevel: 12 },
      { date: new Date(2022, 2, 15), waterLevel: 12.5 },
      { date: new Date(2023, 2, 15), waterLevel: 13 }
    ];
    const currentDate = new Date('2024-01-15');
    
    // Missing post-monsoon data, so 0 complete cycles
    expect(() => predictSeasonalLevels(history, currentDate, 0.5))
      .toThrow(/Insufficient seasonal data.*Found 0 complete seasonal cycle/);
  });
  
  test('predictSeasonalLevels fails with incomplete cycles (only post-monsoon)', () => {
    const history = [
      { date: new Date(2021, 10, 15), waterLevel: 10 },
      { date: new Date(2022, 10, 15), waterLevel: 10.5 },
      { date: new Date(2023, 10, 15), waterLevel: 11 }
    ];
    const currentDate = new Date('2024-01-15');
    
    // Missing pre-monsoon data, so 0 complete cycles
    expect(() => predictSeasonalLevels(history, currentDate, 0.5))
      .toThrow(/Insufficient seasonal data.*Found 0 complete seasonal cycle/);
  });
});

// ============================================================================
// EDGE CASE: STRESS CATEGORY BOUNDARIES (0.1, 0.5, 1.0)
// Requirement 6.1, 6.3
// ============================================================================

describe('Edge Case: Stress Category Boundaries', () => {
  
  // Safe to Semi-critical boundary at 0.1 m/year
  test('Safe category at exactly 0.1 m/year (boundary)', () => {
    const result = predictStressCategoryTransition('Safe', 0.1, 10);
    
    expect(result.predictions.nextCategory).toBe('Semi-critical');
    expect(result.predictions.yearsUntilTransition).toBe(0);
    expect(result.predictions.message).toContain('already exceeds');
  });
  
  test('Safe category just below 0.1 threshold (0.099)', () => {
    const result = predictStressCategoryTransition('Safe', 0.099, 10);
    
    expect(result.predictions.nextCategory).toBe('Semi-critical');
    expect(result.predictions.yearsUntilTransition).toBeGreaterThan(0);
  });
  
  test('Safe category just above 0.1 threshold (0.101)', () => {
    const result = predictStressCategoryTransition('Safe', 0.101, 10);
    
    expect(result.predictions.nextCategory).toBe('Semi-critical');
    expect(result.predictions.yearsUntilTransition).toBe(0);
    expect(result.predictions.warning).toContain('Immediate action required');
  });
  
  // Semi-critical to Critical boundary at 0.5 m/year
  test('Semi-critical category at exactly 0.5 m/year (boundary)', () => {
    const result = predictStressCategoryTransition('Semi-critical', 0.5, 15);
    
    expect(result.predictions.nextCategory).toBe('Critical');
    expect(result.predictions.yearsUntilTransition).toBe(0);
    expect(result.predictions.message).toContain('already exceeds');
  });
  
  test('Semi-critical category just below 0.5 threshold (0.499)', () => {
    const result = predictStressCategoryTransition('Semi-critical', 0.499, 15);
    
    expect(result.predictions.nextCategory).toBe('Critical');
    expect(result.predictions.yearsUntilTransition).toBeGreaterThan(0);
  });
  
  test('Semi-critical category just above 0.5 threshold (0.501)', () => {
    const result = predictStressCategoryTransition('Semi-critical', 0.501, 15);
    
    expect(result.predictions.nextCategory).toBe('Critical');
    expect(result.predictions.yearsUntilTransition).toBe(0);
    expect(result.predictions.warning).toContain('Immediate action required');
  });
  
  // Critical to Over-exploited boundary at 1.0 m/year
  test('Critical category at exactly 1.0 m/year (boundary)', () => {
    const result = predictStressCategoryTransition('Critical', 1.0, 20);
    
    expect(result.predictions.nextCategory).toBe('Over-exploited');
    expect(result.predictions.yearsUntilTransition).toBe(0);
    expect(result.predictions.message).toContain('already exceeds');
  });
  
  test('Critical category just below 1.0 threshold (0.999)', () => {
    const result = predictStressCategoryTransition('Critical', 0.999, 20);
    
    expect(result.predictions.nextCategory).toBe('Over-exploited');
    expect(result.predictions.yearsUntilTransition).toBeGreaterThan(0);
  });
  
  test('Critical category just above 1.0 threshold (1.001)', () => {
    const result = predictStressCategoryTransition('Critical', 1.001, 20);
    
    expect(result.predictions.nextCategory).toBe('Over-exploited');
    expect(result.predictions.yearsUntilTransition).toBe(0);
    expect(result.predictions.warning).toContain('Immediate action required');
  });
});

// ============================================================================
// EDGE CASE: DATE BOUNDARIES (DEC 31, JAN 1, MAY 31, OCT 1)
// Requirement 6.1, 6.3
// ============================================================================

describe('Edge Case: Date Boundaries', () => {
  
  test('December 31 (last day of post-monsoon season)', () => {
    const history = createSeasonalHistory([2020, 2021, 2022, 2023]);
    const currentDate = new Date('2023-12-31');
    
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    // December 31 is post-monsoon, so next season should be pre-monsoon
    expect(result.currentSeason).toBe('post-monsoon');
    expect(result.nextSeason.season).toBe('pre-monsoon');
    expect(result.nextSeason.period).toContain('2024'); // Next year
  });
  
  test('January 1 (first day of pre-monsoon season)', () => {
    const history = createSeasonalHistory([2020, 2021, 2022, 2023]);
    const currentDate = new Date('2024-01-01');
    
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    // January 1 is pre-monsoon, so next season should be post-monsoon
    expect(result.currentSeason).toBe('pre-monsoon');
    expect(result.nextSeason.season).toBe('post-monsoon');
    expect(result.nextSeason.period).toContain('2024'); // Same year
  });
  
  test('May 31 (last day of pre-monsoon season)', () => {
    const history = createSeasonalHistory([2020, 2021, 2022, 2023]);
    const currentDate = new Date('2024-05-31');
    
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    // May 31 is still pre-monsoon
    expect(result.currentSeason).toBe('pre-monsoon');
    expect(result.nextSeason.season).toBe('post-monsoon');
  });
  
  test('June 1 (first day of monsoon, defaults to pre-monsoon logic)', () => {
    const history = createSeasonalHistory([2020, 2021, 2022, 2023]);
    const currentDate = new Date('2024-06-01');
    
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    // June is monsoon season, defaults to pre-monsoon for next season logic
    expect(result.currentSeason).toBe('pre-monsoon');
    expect(result.nextSeason.season).toBe('post-monsoon');
  });
  
  test('September 30 (last day of monsoon, defaults to pre-monsoon logic)', () => {
    const history = createSeasonalHistory([2020, 2021, 2022, 2023]);
    const currentDate = new Date('2024-09-30');
    
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    // September is monsoon season, defaults to pre-monsoon for next season logic
    expect(result.currentSeason).toBe('pre-monsoon');
    expect(result.nextSeason.season).toBe('post-monsoon');
  });
  
  test('October 1 (first day of post-monsoon season)', () => {
    const history = createSeasonalHistory([2020, 2021, 2022, 2023]);
    const currentDate = new Date('2024-10-01');
    
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    // October 1 is post-monsoon
    expect(result.currentSeason).toBe('post-monsoon');
    expect(result.nextSeason.season).toBe('pre-monsoon');
    expect(result.nextSeason.period).toContain('2025'); // Next year
  });
  
  test('Leap year February 29', () => {
    const history = createSeasonalHistory([2020, 2021, 2022, 2023]);
    const currentDate = new Date('2024-02-29'); // 2024 is a leap year
    
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    // February 29 is pre-monsoon
    expect(result.currentSeason).toBe('pre-monsoon');
    expect(result.nextSeason.season).toBe('post-monsoon');
  });
});

// ============================================================================
// EDGE CASE: ZERO AND NEAR-ZERO DECLINE RATES
// Requirement 6.1, 6.3
// ============================================================================

describe('Edge Case: Zero and Near-Zero Decline Rates', () => {
  
  test('Exactly zero decline rate (stable conditions)', () => {
    const result = predictStressCategoryTransition('Safe', 0, 10);
    
    expect(result.predictions.trend).toBe('stable');
    expect(result.predictions.nextCategory).toBeNull();
    expect(result.predictions.message).toContain('Stable conditions');
  });
  
  test('Very small positive decline rate (0.001) treated as stable', () => {
    const result = predictStressCategoryTransition('Safe', 0.001, 10);
    
    // Should be treated as stable (< 0.01 threshold)
    expect(result.predictions.trend).toBe('stable');
    expect(result.predictions.nextCategory).toBeNull();
  });
  
  test('Decline rate at stable threshold (0.01)', () => {
    const result = predictStressCategoryTransition('Safe', 0.01, 10);
    
    // At the threshold, should still be treated as stable
    expect(result.predictions.trend).toBe('stable');
    expect(result.predictions.nextCategory).toBeNull();
  });
  
  test('Decline rate just above stable threshold (0.011)', () => {
    const result = predictStressCategoryTransition('Safe', 0.011, 10);
    
    // Just above threshold, should predict transition
    // But for Safe category, rates < 50% of 0.1 threshold (0.05) are stable
    expect(result.predictions.trend).toBe('stable');
    expect(result.predictions.nextCategory).toBeNull();
  });
  
  test('Very small negative decline rate (-0.001) treated as improving', () => {
    const result = predictStressCategoryTransition('Safe', -0.001, 10);
    
    // Any negative value is improving
    expect(result.predictions.trend).toBe('improving');
    expect(result.predictions.nextCategory).toBeNull();
  });
  
  test('Exactly negative zero (-0) treated as stable', () => {
    const result = predictStressCategoryTransition('Safe', -0, 10);
    
    // -0 is mathematically equal to 0
    expect(result.predictions.trend).toBe('stable');
    expect(result.predictions.nextCategory).toBeNull();
  });
  
  test('computeFutureWaterLevels with zero slope (stable water levels)', () => {
    const history = createHistory(5);
    const slope = 0;
    const intercept = 12;
    const baseDate = new Date('2024-12-15');
    
    const result = computeFutureWaterLevels(history, slope, intercept, baseDate);
    
    // All predictions should be the same (no change)
    result.predictions.forEach(p => {
      expect(p.predictedLevel).toBe(12);
    });
  });
  
  test('computeFutureWaterLevels with very small positive slope', () => {
    const history = createHistory(5);
    const slope = 0.001; // Very slow decline
    const intercept = 12;
    const baseDate = new Date('2024-12-15');
    
    const result = computeFutureWaterLevels(history, slope, intercept, baseDate);
    
    // Predictions should show minimal change
    expect(result.predictions[0].predictedLevel).toBe(12); // 12 + 0.001*1 = 12.001 rounds to 12.00
    expect(result.predictions[3].predictedLevel).toBe(12.01); // 12 + 0.001*5 = 12.005 rounds to 12.01
  });
  
  test('computeFutureWaterLevels with very small negative slope', () => {
    const history = createHistory(5);
    const slope = -0.001; // Very slow improvement
    const intercept = 12;
    const baseDate = new Date('2024-12-15');
    
    const result = computeFutureWaterLevels(history, slope, intercept, baseDate);
    
    // Predictions should show minimal improvement
    expect(result.predictions[0].predictedLevel).toBe(12); // 12 - 0.001*1 = 11.999 rounds to 12.00
    expect(result.predictions[3].predictedLevel).toBe(12); // 12 - 0.001*5 = 11.995 rounds to 12.00
  });
});

// ============================================================================
// EDGE CASE: OVER-EXPLOITED CATEGORY
// Requirement 6.1, 6.3
// ============================================================================

describe('Edge Case: Over-exploited Category', () => {
  
  test('Over-exploited with high decline rate', () => {
    const result = predictStressCategoryTransition('Over-exploited', 1.5, 25);
    
    expect(result.currentCategory).toBe('Over-exploited');
    expect(result.predictions.nextCategory).toBeNull();
    expect(result.predictions.message).toContain('Maximum stress level reached');
    expect(result.predictions.yearsUntilTransition).toBeNull();
  });
  
  test('Over-exploited with zero decline rate', () => {
    const result = predictStressCategoryTransition('Over-exploited', 0, 25);
    
    expect(result.currentCategory).toBe('Over-exploited');
    expect(result.predictions.nextCategory).toBeNull();
    expect(result.predictions.message).toContain('Maximum stress level reached');
  });
  
  test('Over-exploited with improving conditions (negative decline)', () => {
    const result = predictStressCategoryTransition('Over-exploited', -0.5, 25);
    
    expect(result.currentCategory).toBe('Over-exploited');
    expect(result.predictions.nextCategory).toBeNull();
    expect(result.predictions.message).toContain('Maximum stress level reached');
  });
  
  test('Over-exploited at exactly 1.0 m/year (threshold)', () => {
    const result = predictStressCategoryTransition('Over-exploited', 1.0, 25);
    
    expect(result.currentCategory).toBe('Over-exploited');
    expect(result.predictions.nextCategory).toBeNull();
    expect(result.predictions.message).toContain('Maximum stress level reached');
  });
  
  test('Over-exploited with very high decline rate (extreme case)', () => {
    const result = predictStressCategoryTransition('Over-exploited', 5.0, 25);
    
    expect(result.currentCategory).toBe('Over-exploited');
    expect(result.predictions.nextCategory).toBeNull();
    expect(result.predictions.message).toContain('Maximum stress level reached');
  });
  
  test('Over-exploited with shallow water level', () => {
    const result = predictStressCategoryTransition('Over-exploited', 1.5, 5);
    
    expect(result.currentCategory).toBe('Over-exploited');
    expect(result.predictions.nextCategory).toBeNull();
    expect(result.predictions.message).toContain('Maximum stress level reached');
  });
  
  test('Over-exploited with deep water level', () => {
    const result = predictStressCategoryTransition('Over-exploited', 1.5, 100);
    
    expect(result.currentCategory).toBe('Over-exploited');
    expect(result.predictions.nextCategory).toBeNull();
    expect(result.predictions.message).toContain('Maximum stress level reached');
  });
});

// ============================================================================
// ADDITIONAL EDGE CASES
// ============================================================================

describe('Additional Edge Cases', () => {
  
  test('computeFutureWaterLevels with very large slope (rapid decline)', () => {
    const history = createHistory(5);
    const slope = 10; // Very rapid decline
    const intercept = 12;
    const baseDate = new Date('2024-12-15');
    
    const result = computeFutureWaterLevels(history, slope, intercept, baseDate);
    
    // Should handle large values correctly
    expect(result.predictions[0].predictedLevel).toBe(22); // 12 + 10*1
    expect(result.predictions[3].predictedLevel).toBe(62); // 12 + 10*5
  });
  
  test('computeFutureWaterLevels with negative intercept', () => {
    const history = createHistory(5);
    const slope = 0.5;
    const intercept = -5; // Negative intercept (unusual but valid)
    const baseDate = new Date('2024-12-15');
    
    const result = computeFutureWaterLevels(history, slope, intercept, baseDate);
    
    // Should handle negative intercept correctly
    expect(result.predictions[0].predictedLevel).toBe(-4.5); // -5 + 0.5*1
    expect(result.predictions[3].predictedLevel).toBe(-2.5); // -5 + 0.5*5
  });
  
  test('predictStressCategoryTransition with very shallow water (1 meter)', () => {
    const result = predictStressCategoryTransition('Safe', 0.08, 1);
    
    // Should handle shallow water correctly
    expect(result.predictions.nextCategory).toBe('Semi-critical');
    expect(result.predictions.yearsUntilTransition).toBeGreaterThan(0);
  });
  
  test('predictStressCategoryTransition with very deep water (1000 meters)', () => {
    const result = predictStressCategoryTransition('Safe', 0.08, 1000);
    
    // Should handle deep water correctly
    // Deeper water takes longer to transition
    expect(result.predictions.nextCategory).toBe('Semi-critical');
    expect(result.predictions.yearsUntilTransition).toBeGreaterThan(0);
    // Should be capped at 20 years maximum
    expect(result.predictions.yearsUntilTransition).toBeLessThanOrEqual(20);
  });
  
  test('predictSeasonalLevels with exactly 5 years of data (window size)', () => {
    const history = createSeasonalHistory([2019, 2020, 2021, 2022, 2023]);
    const currentDate = new Date('2024-01-15');
    
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    // Should use all 5 years for the average
    expect(result.methodology).toContain('5-year seasonal average');
    expect(result.nextSeason).toBeDefined();
    expect(result.followingSeason).toBeDefined();
  });
  
  test('predictSeasonalLevels with more than 5 years of data', () => {
    const history = createSeasonalHistory([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023]);
    const currentDate = new Date('2024-01-15');
    
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    // Should still use 5-year window (most recent 5 years)
    expect(result.methodology).toContain('5-year seasonal average');
    expect(result.nextSeason).toBeDefined();
    expect(result.followingSeason).toBeDefined();
  });
});
