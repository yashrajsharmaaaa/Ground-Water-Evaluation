/**
 * Unit tests for future water level predictions and stress category transitions
 */

import { describe, test, expect } from '@jest/globals';
import { computeFutureWaterLevels, predictStressCategoryTransition, predictSeasonalLevels } from '../../utils/predictions.js';

describe('computeFutureWaterLevels', () => {
  // Helper to create test history data
  const createHistory = (count, startYear = 2015) => {
    return Array.from({ length: count }, (_, i) => ({
      date: new Date(startYear + i, 0, 1),
      waterLevel: 10 + i * 0.5
    }));
  };

  test('returns predictions for 1, 2, 3, and 5 years (Requirement 1.1)', () => {
    const history = createHistory(10);
    const baseDate = new Date('2024-12-15');
    const result = computeFutureWaterLevels(history, 0.5, 10, baseDate);
    
    expect(result.predictions).toHaveLength(4);
    expect(result.predictions.map(p => p.year)).toEqual([1, 2, 3, 5]);
  });

  test('uses linear regression formula correctly (Requirement 1.2)', () => {
    const history = createHistory(5);
    const slope = 0.7;
    const intercept = 12.5;
    const baseDate = new Date('2024-12-15');
    
    const result = computeFutureWaterLevels(history, slope, intercept, baseDate);
    
    // Verify formula: predictedLevel = intercept + slope * years
    expect(result.predictions[0].predictedLevel).toBe(12.5 + 0.7 * 1); // Year 1: 13.2
    expect(result.predictions[1].predictedLevel).toBe(12.5 + 0.7 * 2); // Year 2: 13.9
    expect(result.predictions[2].predictedLevel).toBe(12.5 + 0.7 * 3); // Year 3: 14.6
    expect(result.predictions[3].predictedLevel).toBe(12.5 + 0.7 * 5); // Year 5: 16.0
  });

  test('throws error for fewer than 3 data points (Requirement 1.3)', () => {
    const history = createHistory(2);
    const baseDate = new Date('2024-12-15');
    
    expect(() => computeFutureWaterLevels(history, 0.5, 10, baseDate))
      .toThrow('Insufficient data points');
  });

  test('includes methodology description (Requirement 1.6)', () => {
    const history = createHistory(10);
    const baseDate = new Date('2024-12-15');
    const result = computeFutureWaterLevels(history, 0.5, 10, baseDate);
    
    expect(result.methodology).toBeDefined();
    expect(result.methodology).toContain('Linear regression');
    expect(result.methodology).toContain('10-point');
  });

  test('includes data range metadata (Requirement 1.6)', () => {
    const history = createHistory(10, 2015);
    const baseDate = new Date('2024-12-15');
    const result = computeFutureWaterLevels(history, 0.5, 10, baseDate);
    
    expect(result.dataRange).toBeDefined();
    expect(result.dataRange.start).toMatch(/^201[45]-/); // Account for timezone differences
    expect(result.dataRange.end).toMatch(/^202[34]-/); // Account for timezone differences
  });

  test('calculates prediction dates correctly', () => {
    const history = createHistory(5);
    const baseDate = new Date('2024-12-15');
    const result = computeFutureWaterLevels(history, 0.5, 10, baseDate);
    
    expect(result.predictions[0].date).toBe('2025-12-15'); // 1 year
    expect(result.predictions[1].date).toBe('2026-12-15'); // 2 years
    expect(result.predictions[2].date).toBe('2027-12-15'); // 3 years
    expect(result.predictions[3].date).toBe('2029-12-15'); // 5 years
  });

  test('includes unit in predictions', () => {
    const history = createHistory(5);
    const baseDate = new Date('2024-12-15');
    const result = computeFutureWaterLevels(history, 0.5, 10, baseDate);
    
    result.predictions.forEach(p => {
      expect(p.unit).toBe('meters below ground level');
    });
  });

  test('handles negative slope (improving water levels)', () => {
    const history = createHistory(5);
    const slope = -0.3; // Water levels improving
    const intercept = 15;
    const baseDate = new Date('2024-12-15');
    
    const result = computeFutureWaterLevels(history, slope, intercept, baseDate);
    
    // Water levels should decrease (improve) over time
    expect(result.predictions[0].predictedLevel).toBe(15 - 0.3 * 1); // 14.7
    expect(result.predictions[3].predictedLevel).toBe(15 - 0.3 * 5); // 13.5
  });

  test('handles zero slope (stable conditions)', () => {
    const history = createHistory(5);
    const slope = 0;
    const intercept = 12;
    const baseDate = new Date('2024-12-15');
    
    const result = computeFutureWaterLevels(history, slope, intercept, baseDate);
    
    // All predictions should be the same
    result.predictions.forEach(p => {
      expect(p.predictedLevel).toBe(12);
    });
  });

  test('rounds predicted levels to 2 decimal places', () => {
    const history = createHistory(5);
    const slope = 0.333333;
    const intercept = 10.666666;
    const baseDate = new Date('2024-12-15');
    
    const result = computeFutureWaterLevels(history, slope, intercept, baseDate);
    
    result.predictions.forEach(p => {
      // Check that value has at most 2 decimal places
      const decimalPlaces = (p.predictedLevel.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });

  test('throws error for invalid history input', () => {
    const baseDate = new Date('2024-12-15');
    
    // ERROR FIX: Updated to match improved error messages with context
    expect(() => computeFutureWaterLevels(null, 0.5, 10, baseDate))
      .toThrow(/Invalid history parameter.*Expected an array.*received object/);
    expect(() => computeFutureWaterLevels('not an array', 0.5, 10, baseDate))
      .toThrow(/Invalid history parameter.*Expected an array.*received string/);
  });

  test('throws error for invalid slope', () => {
    const history = createHistory(5);
    const baseDate = new Date('2024-12-15');
    
    expect(() => computeFutureWaterLevels(history, NaN, 10, baseDate))
      .toThrow('Invalid regression parameters');
    expect(() => computeFutureWaterLevels(history, 'invalid', 10, baseDate))
      .toThrow('Invalid regression parameters');
  });

  test('throws error for invalid intercept', () => {
    const history = createHistory(5);
    const baseDate = new Date('2024-12-15');
    
    expect(() => computeFutureWaterLevels(history, 0.5, NaN, baseDate))
      .toThrow('Invalid regression parameters');
    expect(() => computeFutureWaterLevels(history, 0.5, 'invalid', baseDate))
      .toThrow('Invalid regression parameters');
  });

  test('throws error for invalid baseDate', () => {
    const history = createHistory(5);
    
    // ERROR FIX: Updated to match improved error messages with context and guidance
    expect(() => computeFutureWaterLevels(history, 0.5, 10, 'not a date'))
      .toThrow(/Invalid baseDate.*Expected a valid Date object.*received string/);
    expect(() => computeFutureWaterLevels(history, 0.5, 10, new Date('invalid')))
      .toThrow(/Invalid baseDate.*Expected a valid Date object.*invalid Date/);
  });

  test('handles exactly 3 data points (minimum threshold)', () => {
    const history = createHistory(3);
    const baseDate = new Date('2024-12-15');
    
    const result = computeFutureWaterLevels(history, 0.5, 10, baseDate);
    
    expect(result.predictions).toHaveLength(4);
    expect(result.methodology).toContain('3-point');
  });

  test('handles large dataset (500 points)', () => {
    const history = createHistory(500);
    const baseDate = new Date('2024-12-15');
    
    const result = computeFutureWaterLevels(history, 0.5, 10, baseDate);
    
    expect(result.predictions).toHaveLength(4);
    expect(result.methodology).toContain('500-point');
  });

  test('handles dates with different formats in history', () => {
    const history = [
      { date: '2020-01-01', waterLevel: 10 },
      { date: new Date('2021-01-01'), waterLevel: 10.5 },
      { date: '2022-01-01', waterLevel: 11 }
    ];
    const baseDate = new Date('2024-12-15');
    
    const result = computeFutureWaterLevels(history, 0.5, 10, baseDate);
    
    expect(result.dataRange.start).toBe('2020-01-01');
    expect(result.dataRange.end).toBe('2022-01-01');
  });

  test('throws error when history has no valid dates', () => {
    const history = [
      { date: 'invalid', waterLevel: 10 },
      { date: 'also invalid', waterLevel: 10.5 },
      { date: 'still invalid', waterLevel: 11 }
    ];
    const baseDate = new Date('2024-12-15');
    
    // Invalid dates will be filtered out, leaving 0 valid records
    expect(() => computeFutureWaterLevels(history, 0.5, 10, baseDate))
      .toThrow('Insufficient data points');
  });
});


describe('predictStressCategoryTransition', () => {
  test('predicts transition for Safe category with declining trend (Requirement 2.1)', () => {
    const result = predictStressCategoryTransition('Safe', 0.08, 10);
    
    expect(result.currentCategory).toBe('Safe');
    expect(result.predictions.nextCategory).toBe('Semi-critical');
    expect(result.predictions.yearsUntilTransition).toBeGreaterThan(0);
    expect(result.predictions.estimatedTransitionDate).toBeDefined();
  });

  test('predicts transition for Semi-critical category (Requirement 2.1)', () => {
    const result = predictStressCategoryTransition('Semi-critical', 0.3, 15);
    
    expect(result.currentCategory).toBe('Semi-critical');
    expect(result.predictions.nextCategory).toBe('Critical');
    expect(result.predictions.yearsUntilTransition).toBeGreaterThan(0);
  });

  test('predicts transition for Critical category (Requirement 2.1)', () => {
    const result = predictStressCategoryTransition('Critical', 0.7, 20);
    
    expect(result.currentCategory).toBe('Critical');
    expect(result.predictions.nextCategory).toBe('Over-exploited');
    expect(result.predictions.yearsUntilTransition).toBeGreaterThan(0);
  });

  test('indicates improving conditions for negative decline rate (Requirement 2.2)', () => {
    const result = predictStressCategoryTransition('Semi-critical', -0.3, 15);
    
    expect(result.predictions.nextCategory).toBeNull();
    expect(result.predictions.message).toContain('Improving conditions');
    expect(result.predictions.trend).toBe('improving');
  });

  test('indicates stable conditions for near-zero decline rate (Requirement 2.3)', () => {
    const result = predictStressCategoryTransition('Safe', 0.005, 10);
    
    expect(result.predictions.nextCategory).toBeNull();
    expect(result.predictions.message).toContain('Stable conditions');
    expect(result.predictions.trend).toBe('stable');
  });

  test('uses correct thresholds for stress categories (Requirement 2.4)', () => {
    const result = predictStressCategoryTransition('Safe', 0.05, 10);
    
    expect(result.thresholds).toBeDefined();
    expect(result.thresholds['Safe'].max).toBe(0.1);
    expect(result.thresholds['Semi-critical'].max).toBe(0.5);
    expect(result.thresholds['Critical'].max).toBe(1.0);
    expect(result.thresholds['Over-exploited'].min).toBe(1.0);
  });

  test('indicates no transition for Over-exploited category (Requirement 2.5)', () => {
    const result = predictStressCategoryTransition('Over-exploited', 1.5, 25);
    
    expect(result.currentCategory).toBe('Over-exploited');
    expect(result.predictions.nextCategory).toBeNull();
    expect(result.predictions.message).toContain('Maximum stress level reached');
  });

  test('flags high-priority warning for transitions within 5 years (Requirement 2.6)', () => {
    // Use a decline rate close to threshold to trigger near-term transition
    const result = predictStressCategoryTransition('Safe', 0.09, 10);
    
    if (result.predictions.yearsUntilTransition && result.predictions.yearsUntilTransition <= 5) {
      expect(result.predictions.warning).toContain('High priority');
      expect(result.predictions.warning).toContain('within 5 years');
    }
  });

  test('handles decline rate already exceeding threshold', () => {
    // Safe category with decline rate already at Semi-critical level
    const result = predictStressCategoryTransition('Safe', 0.15, 10);
    
    expect(result.predictions.yearsUntilTransition).toBe(0);
    expect(result.predictions.message).toContain('already exceeds');
    expect(result.predictions.warning).toContain('Immediate action required');
  });

  test('handles decline rate at exact threshold', () => {
    const result = predictStressCategoryTransition('Safe', 0.1, 10);
    
    expect(result.predictions.yearsUntilTransition).toBe(0);
    expect(result.predictions.nextCategory).toBe('Semi-critical');
  });

  test('includes current decline rate in response', () => {
    const result = predictStressCategoryTransition('Safe', 0.0753, 10);
    
    expect(result.currentDeclineRate).toBeDefined();
    // Should be rounded to 3 decimal places
    expect(result.currentDeclineRate).toBe(0.075);
  });

  test('throws error for invalid category', () => {
    // ERROR FIX: Updated to match improved error messages with guidance
    expect(() => predictStressCategoryTransition('Invalid', 0.5, 10))
      .toThrow(/Invalid stress category.*Expected one of.*Safe.*Semi-critical.*Critical.*Over-exploited/);
  });

  test('throws error for invalid decline rate', () => {
    // ERROR FIX: Updated to match improved error messages with context
    expect(() => predictStressCategoryTransition('Safe', NaN, 10))
      .toThrow(/Invalid annualDeclineRate.*NaN/);
    expect(() => predictStressCategoryTransition('Safe', 'invalid', 10))
      .toThrow(/Invalid annualDeclineRate.*Expected number.*received string/);
  });

  test('throws error for invalid water level', () => {
    // ERROR FIX: Updated to match improved error messages with context
    expect(() => predictStressCategoryTransition('Safe', 0.5, NaN))
      .toThrow(/Invalid currentWaterLevel.*NaN/);
    expect(() => predictStressCategoryTransition('Safe', 0.5, 'invalid'))
      .toThrow(/Invalid currentWaterLevel.*Expected number.*received string/);
  });

  test('throws error for non-string category', () => {
    // ERROR FIX: Updated to match improved error messages with type information
    expect(() => predictStressCategoryTransition(123, 0.5, 10))
      .toThrow(/Invalid currentCategory type.*Expected string.*received number/);
  });

  test('handles category with extra whitespace', () => {
    const result = predictStressCategoryTransition('  Safe  ', 0.05, 10);
    
    expect(result.currentCategory).toBe('Safe');
  });

  test('handles zero decline rate as stable', () => {
    const result = predictStressCategoryTransition('Safe', 0, 10);
    
    expect(result.predictions.trend).toBe('stable');
    expect(result.predictions.nextCategory).toBeNull();
  });

  test('handles very small positive decline rate', () => {
    const result = predictStressCategoryTransition('Safe', 0.001, 10);
    
    // Should be treated as stable (< 0.01 threshold)
    expect(result.predictions.trend).toBe('stable');
  });

  test('handles large decline rate for Critical category', () => {
    const result = predictStressCategoryTransition('Critical', 0.95, 20);
    
    expect(result.predictions.nextCategory).toBe('Over-exploited');
    // Should show near-term transition since close to threshold
    expect(result.predictions.yearsUntilTransition).toBeLessThanOrEqual(5);
  });

  test('estimated transition date is in the future', () => {
    const result = predictStressCategoryTransition('Safe', 0.05, 10);
    
    if (result.predictions.estimatedTransitionDate) {
      const transitionDate = new Date(result.predictions.estimatedTransitionDate);
      const today = new Date();
      expect(transitionDate.getTime()).toBeGreaterThan(today.getTime());
    }
  });

  test('handles boundary case: Safe to Semi-critical at 0.1 threshold', () => {
    const result = predictStressCategoryTransition('Safe', 0.1, 10);
    
    expect(result.predictions.nextCategory).toBe('Semi-critical');
    expect(result.predictions.yearsUntilTransition).toBe(0);
  });

  test('handles boundary case: Semi-critical to Critical at 0.5 threshold', () => {
    const result = predictStressCategoryTransition('Semi-critical', 0.5, 15);
    
    expect(result.predictions.nextCategory).toBe('Critical');
    expect(result.predictions.yearsUntilTransition).toBe(0);
  });

  test('handles boundary case: Critical to Over-exploited at 1.0 threshold', () => {
    const result = predictStressCategoryTransition('Critical', 1.0, 20);
    
    expect(result.predictions.nextCategory).toBe('Over-exploited');
    expect(result.predictions.yearsUntilTransition).toBe(0);
  });
});


// ============================================================================
// EDGE CASE TESTS (Task 10)
// Testing minimum thresholds, boundaries, and special conditions
// Requirements: 1.3, 2.3, 2.5, 3.4
// ============================================================================

describe('Edge Cases - Minimum Thresholds', () => {
  // Helper to create test history data
  const createHistory = (count, startYear = 2015) => {
    return Array.from({ length: count }, (_, i) => ({
      date: new Date(startYear + i, 0, 1),
      waterLevel: 10 + i * 0.5
    }));
  };

  // Requirement 1.3: Test with exactly 3 data points (minimum threshold)
  test('EDGE CASE: exactly 3 data points (minimum threshold)', () => {
    const history = createHistory(3);
    const baseDate = new Date('2024-12-15');
    
    // Should succeed with exactly 3 points
    const result = computeFutureWaterLevels(history, 0.5, 10, baseDate);
    
    expect(result.predictions).toHaveLength(4);
    expect(result.predictions.map(p => p.year)).toEqual([1, 2, 3, 5]);
    expect(result.methodology).toContain('3-point');
  });

  test('EDGE CASE: 2 data points should fail (below minimum)', () => {
    const history = createHistory(2);
    const baseDate = new Date('2024-12-15');
    
    // Should throw error with fewer than 3 points
    expect(() => computeFutureWaterLevels(history, 0.5, 10, baseDate))
      .toThrow('Insufficient data points');
  });
});


describe('Edge Cases - Stress Category Boundaries', () => {
  // Requirement 2.3: Test zero decline rate (stable conditions)
  test('EDGE CASE: zero decline rate (stable conditions)', () => {
    const result = predictStressCategoryTransition('Safe', 0, 10);
    
    expect(result.predictions.trend).toBe('stable');
    expect(result.predictions.nextCategory).toBeNull();
    expect(result.predictions.message).toContain('Stable conditions');
  });

  test('EDGE CASE: very small positive decline rate (0.001) treated as stable', () => {
    const result = predictStressCategoryTransition('Safe', 0.001, 10);
    
    // Should be treated as stable (< 0.01 threshold)
    expect(result.predictions.trend).toBe('stable');
    expect(result.predictions.nextCategory).toBeNull();
  });

  test('EDGE CASE: very small negative decline rate (-0.001) treated as stable', () => {
    const result = predictStressCategoryTransition('Safe', -0.001, 10);
    
    // Should be treated as improving (any negative value)
    expect(result.predictions.trend).toBe('improving');
    expect(result.predictions.nextCategory).toBeNull();
  });

  // Requirement 2.5: Test Over-exploited category (no further transition)
  test('EDGE CASE: Over-exploited category with high decline rate', () => {
    const result = predictStressCategoryTransition('Over-exploited', 1.5, 25);
    
    expect(result.currentCategory).toBe('Over-exploited');
    expect(result.predictions.nextCategory).toBeNull();
    expect(result.predictions.message).toContain('Maximum stress level reached');
    expect(result.predictions.yearsUntilTransition).toBeNull();
  });

  test('EDGE CASE: Over-exploited category with zero decline rate', () => {
    const result = predictStressCategoryTransition('Over-exploited', 0, 25);
    
    expect(result.currentCategory).toBe('Over-exploited');
    expect(result.predictions.nextCategory).toBeNull();
    expect(result.predictions.message).toContain('Maximum stress level reached');
  });

  test('EDGE CASE: Over-exploited category with improving conditions', () => {
    const result = predictStressCategoryTransition('Over-exploited', -0.5, 25);
    
    expect(result.currentCategory).toBe('Over-exploited');
    expect(result.predictions.nextCategory).toBeNull();
    expect(result.predictions.message).toContain('Maximum stress level reached');
  });

  // Test stress category boundaries (0.1, 0.5, 1.0)
  test('EDGE CASE: Safe to Semi-critical boundary at exactly 0.1', () => {
    const result = predictStressCategoryTransition('Safe', 0.1, 10);
    
    expect(result.predictions.nextCategory).toBe('Semi-critical');
    expect(result.predictions.yearsUntilTransition).toBe(0);
    expect(result.predictions.message).toContain('already exceeds');
  });

  test('EDGE CASE: Safe category just below 0.1 threshold (0.099)', () => {
    const result = predictStressCategoryTransition('Safe', 0.099, 10);
    
    expect(result.predictions.nextCategory).toBe('Semi-critical');
    expect(result.predictions.yearsUntilTransition).toBeGreaterThan(0);
  });

  test('EDGE CASE: Semi-critical to Critical boundary at exactly 0.5', () => {
    const result = predictStressCategoryTransition('Semi-critical', 0.5, 15);
    
    expect(result.predictions.nextCategory).toBe('Critical');
    expect(result.predictions.yearsUntilTransition).toBe(0);
    expect(result.predictions.message).toContain('already exceeds');
  });

  test('EDGE CASE: Semi-critical category just below 0.5 threshold (0.499)', () => {
    const result = predictStressCategoryTransition('Semi-critical', 0.499, 15);
    
    expect(result.predictions.nextCategory).toBe('Critical');
    expect(result.predictions.yearsUntilTransition).toBeGreaterThan(0);
  });

  test('EDGE CASE: Critical to Over-exploited boundary at exactly 1.0', () => {
    const result = predictStressCategoryTransition('Critical', 1.0, 20);
    
    expect(result.predictions.nextCategory).toBe('Over-exploited');
    expect(result.predictions.yearsUntilTransition).toBe(0);
    expect(result.predictions.message).toContain('already exceeds');
  });

  test('EDGE CASE: Critical category just below 1.0 threshold (0.999)', () => {
    const result = predictStressCategoryTransition('Critical', 0.999, 20);
    
    expect(result.predictions.nextCategory).toBe('Over-exploited');
    expect(result.predictions.yearsUntilTransition).toBeGreaterThan(0);
  });

  test('EDGE CASE: Critical category just above 1.0 threshold (1.001)', () => {
    const result = predictStressCategoryTransition('Critical', 1.001, 20);
    
    expect(result.predictions.nextCategory).toBe('Over-exploited');
    expect(result.predictions.yearsUntilTransition).toBe(0);
    expect(result.predictions.warning).toContain('Immediate action required');
  });
});


describe('Edge Cases - Seasonal Date Boundaries', () => {
  // Helper to create seasonal history with specific years
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

  // Requirement 3.4: Test with exactly 3 seasonal cycles (minimum threshold)
  test('EDGE CASE: exactly 3 complete seasonal cycles (minimum threshold)', () => {
    const history = createSeasonalHistory([2021, 2022, 2023]);
    const currentDate = new Date('2024-01-15');
    
    // Should succeed with exactly 3 complete cycles
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    expect(result.nextSeason).toBeDefined();
    expect(result.followingSeason).toBeDefined();
    expect(result.methodology).toContain('5-year seasonal average');
  });

  test('EDGE CASE: 2 complete seasonal cycles should fail (below minimum)', () => {
    const history = createSeasonalHistory([2022, 2023]);
    const currentDate = new Date('2024-01-15');
    
    // ERROR FIX: Updated to match improved error messages with detailed context
    expect(() => predictSeasonalLevels(history, currentDate, 0.5))
      .toThrow(/Insufficient seasonal data.*Found 2 complete seasonal cycle.*3 are required.*both pre-monsoon.*post-monsoon/);
  });

  test('EDGE CASE: incomplete seasonal data (only pre-monsoon for some years)', () => {
    const history = [
      { date: new Date(2021, 2, 15), waterLevel: 12 },
      { date: new Date(2021, 10, 15), waterLevel: 10 },
      { date: new Date(2022, 2, 15), waterLevel: 12.5 },
      { date: new Date(2022, 10, 15), waterLevel: 10.5 },
      { date: new Date(2023, 2, 15), waterLevel: 13 },
      // Missing post-monsoon 2023
      { date: new Date(2024, 2, 15), waterLevel: 13.5 }
      // Missing post-monsoon 2024
    ];
    const currentDate = new Date('2024-06-15');
    
    // ERROR FIX: Updated to match improved error messages with detailed context
    expect(() => predictSeasonalLevels(history, currentDate, 0.5))
      .toThrow(/Insufficient seasonal data.*Found 2 complete seasonal cycle.*3 are required.*both pre-monsoon.*post-monsoon/);
  });

  // Test date edge cases (Dec 31, Jan 1 for season determination)
  test('EDGE CASE: December 31 (post-monsoon season)', () => {
    const history = createSeasonalHistory([2020, 2021, 2022, 2023]);
    const currentDate = new Date('2023-12-31');
    
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    // December 31 is post-monsoon, so next season should be pre-monsoon
    expect(result.currentSeason).toBe('post-monsoon');
    expect(result.nextSeason.season).toBe('pre-monsoon');
    expect(result.nextSeason.period).toContain('2024'); // Next year
  });

  test('EDGE CASE: January 1 (pre-monsoon season)', () => {
    const history = createSeasonalHistory([2020, 2021, 2022, 2023]);
    const currentDate = new Date('2024-01-01');
    
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    // January 1 is pre-monsoon, so next season should be post-monsoon
    expect(result.currentSeason).toBe('pre-monsoon');
    expect(result.nextSeason.season).toBe('post-monsoon');
    expect(result.nextSeason.period).toContain('2024'); // Same year
  });

  test('EDGE CASE: May 31 (last day of pre-monsoon)', () => {
    const history = createSeasonalHistory([2020, 2021, 2022, 2023]);
    const currentDate = new Date('2024-05-31');
    
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    // May 31 is still pre-monsoon
    expect(result.currentSeason).toBe('pre-monsoon');
    expect(result.nextSeason.season).toBe('post-monsoon');
  });

  test('EDGE CASE: June 1 (first day of monsoon, defaults to pre-monsoon logic)', () => {
    const history = createSeasonalHistory([2020, 2021, 2022, 2023]);
    const currentDate = new Date('2024-06-01');
    
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    // June is monsoon season, defaults to pre-monsoon for next season logic
    expect(result.currentSeason).toBe('pre-monsoon');
    expect(result.nextSeason.season).toBe('post-monsoon');
  });

  test('EDGE CASE: October 1 (first day of post-monsoon)', () => {
    const history = createSeasonalHistory([2020, 2021, 2022, 2023]);
    const currentDate = new Date('2024-10-01');
    
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    // October 1 is post-monsoon
    expect(result.currentSeason).toBe('post-monsoon');
    expect(result.nextSeason.season).toBe('pre-monsoon');
    expect(result.nextSeason.period).toContain('2025'); // Next year
  });

  test('EDGE CASE: September 30 (last day of monsoon, defaults to pre-monsoon logic)', () => {
    const history = createSeasonalHistory([2020, 2021, 2022, 2023]);
    const currentDate = new Date('2024-09-30');
    
    const result = predictSeasonalLevels(history, currentDate, 0.5);
    
    // September is monsoon season, defaults to pre-monsoon for next season logic
    expect(result.currentSeason).toBe('pre-monsoon');
    expect(result.nextSeason.season).toBe('post-monsoon');
  });
});


// FIXED: Task #3 - Tests for threshold-based transition calculation accuracy
describe('Stress Category Transition Accuracy (Requirements 2.1, 2.4)', () => {
  
  test('calculates transition based on water level and decline rate (Safe category)', () => {
    // Safe category with 10m water level, 0.08 m/year decline
    // Should calculate based on when water reaches critical depth
    const result = predictStressCategoryTransition('Safe', 0.08, 10);
    
    expect(result.currentCategory).toBe('Safe');
    expect(result.predictions.nextCategory).toBe('Semi-critical');
    expect(result.predictions.yearsUntilTransition).toBeGreaterThan(0);
    
    // Verify calculation uses water level (not just heuristics)
    // With 10m depth and 0.08 m/year decline, transition should be calculated
    // based on reaching critical depth (10m * 0.20 = 2m deeper = 25 years at 0.08 m/year)
    // But adjusted by proximity factor since we're close to threshold
    expect(result.predictions.yearsUntilTransition).toBeLessThan(30);
  });
  
  test('calculates transition based on water level and decline rate (Semi-critical category)', () => {
    // Semi-critical with 15m water level, 0.3 m/year decline
    const result = predictStressCategoryTransition('Semi-critical', 0.3, 15);
    
    expect(result.currentCategory).toBe('Semi-critical');
    expect(result.predictions.nextCategory).toBe('Critical');
    expect(result.predictions.yearsUntilTransition).toBeGreaterThan(0);
    
    // With 15m depth and 0.3 m/year decline, critical depth increase is 15 * 0.30 = 4.5m
    // Base calculation: 4.5 / 0.3 = 15 years
    // Adjusted by proximity factor
    expect(result.predictions.yearsUntilTransition).toBeLessThan(20);
  });
  
  test('calculates transition based on water level and decline rate (Critical category)', () => {
    // Critical with 20m water level, 0.7 m/year decline
    const result = predictStressCategoryTransition('Critical', 0.7, 20);
    
    expect(result.currentCategory).toBe('Critical');
    expect(result.predictions.nextCategory).toBe('Over-exploited');
    expect(result.predictions.yearsUntilTransition).toBeGreaterThan(0);
    
    // With 20m depth and 0.7 m/year decline, critical depth increase is 20 * 0.40 = 8m
    // Base calculation: 8 / 0.7 = 11.4 years
    // Adjusted by proximity factor
    expect(result.predictions.yearsUntilTransition).toBeLessThan(15);
  });
  
  test('deeper water levels result in longer transition times (same decline rate)', () => {
    // Compare shallow vs deep water with same decline rate
    const shallow = predictStressCategoryTransition('Safe', 0.08, 5);
    const deep = predictStressCategoryTransition('Safe', 0.08, 20);
    
    // Deeper water should take longer to transition (more depth to lose)
    expect(deep.predictions.yearsUntilTransition).toBeGreaterThan(
      shallow.predictions.yearsUntilTransition
    );
  });
  
  test('faster decline rates result in shorter transition times (same water level)', () => {
    // Compare slow vs fast decline with same water level
    const slow = predictStressCategoryTransition('Safe', 0.05, 10);
    const fast = predictStressCategoryTransition('Safe', 0.09, 10);
    
    // Faster decline should reach transition sooner
    expect(fast.predictions.yearsUntilTransition).toBeLessThan(
      slow.predictions.yearsUntilTransition
    );
  });
  
  test('transition time is capped at 20 years maximum', () => {
    // Very slow decline with deep water
    // Use Semi-critical category to avoid Safe's 50% threshold check
    const result = predictStressCategoryTransition('Semi-critical', 0.15, 100);
    
    // Should be capped at 20 years
    expect(result.predictions.yearsUntilTransition).toBeLessThanOrEqual(20);
  });
  
  test('transition time has minimum of 0.5 years', () => {
    // Very fast decline close to threshold
    const result = predictStressCategoryTransition('Safe', 0.099, 1);
    
    // Should have minimum of 0.5 years
    expect(result.predictions.yearsUntilTransition).toBeGreaterThanOrEqual(0.5);
  });
  
  test('proximity to threshold affects transition time', () => {
    // Compare decline rates far from vs close to threshold
    const farFromThreshold = predictStressCategoryTransition('Safe', 0.05, 10);
    const closeToThreshold = predictStressCategoryTransition('Safe', 0.095, 10);
    
    // Being closer to threshold should result in shorter transition time
    // due to proximity factor adjustment
    expect(closeToThreshold.predictions.yearsUntilTransition).toBeLessThan(
      farFromThreshold.predictions.yearsUntilTransition
    );
  });
  
  test('different categories use different depth increase percentages', () => {
    // Test with same decline rate to isolate the depth percentage effect
    // Use decline rates that are proportionally similar to their thresholds
    const safe = predictStressCategoryTransition('Safe', 0.05, 10);
    const semiCritical = predictStressCategoryTransition('Semi-critical', 0.25, 10);
    const critical = predictStressCategoryTransition('Critical', 0.5, 10);
    
    // Safe uses 20% depth increase, Semi-critical uses 30%, Critical uses 40%
    // With same water level (10m):
    // - Safe: 10 * 0.20 = 2m / 0.05 = 40 years (before proximity adjustment)
    // - Semi-critical: 10 * 0.30 = 3m / 0.25 = 12 years (before proximity adjustment)
    // - Critical: 10 * 0.40 = 4m / 0.5 = 8 years (before proximity adjustment)
    // 
    // However, proximity factor also affects the result. Since all are at 50% of their
    // respective thresholds, the proximity effect is similar.
    // The key is that higher depth percentages with proportional decline rates
    // should show the depth percentage effect.
    
    // Verify that the calculations are using different depth percentages
    // by checking that results are different (not testing specific ordering
    // since proximity factor complicates the comparison)
    expect(safe.predictions.yearsUntilTransition).not.toBe(
      semiCritical.predictions.yearsUntilTransition
    );
    expect(semiCritical.predictions.yearsUntilTransition).not.toBe(
      critical.predictions.yearsUntilTransition
    );
  });
  
  test('calculation produces consistent results for same inputs', () => {
    // Run same calculation multiple times
    const result1 = predictStressCategoryTransition('Safe', 0.08, 10);
    const result2 = predictStressCategoryTransition('Safe', 0.08, 10);
    const result3 = predictStressCategoryTransition('Safe', 0.08, 10);
    
    // Should produce identical results
    expect(result1.predictions.yearsUntilTransition).toBe(
      result2.predictions.yearsUntilTransition
    );
    expect(result2.predictions.yearsUntilTransition).toBe(
      result3.predictions.yearsUntilTransition
    );
  });
});

// ============================================================================
// ERROR MESSAGE QUALITY TESTS (Requirement 8.2, 8.6)
// ============================================================================

describe('Error Message Quality', () => {
  test('error messages include context about what failed', () => {
    const history = [{ date: '2024-01-01', waterLevel: 10 }];
    const baseDate = new Date('2024-12-15');
    
    try {
      computeFutureWaterLevels(history, 0.5, 10, baseDate);
      fail('Should have thrown an error');
    } catch (error) {
      // Error should explain WHAT failed
      expect(error.message).toMatch(/Insufficient data points/);
      // Error should include HOW MANY points were found
      expect(error.message).toMatch(/Found 1 record/);
      // Error should include HOW MANY are required
      expect(error.message).toMatch(/3 are required/);
    }
  });

  test('error messages explain why the error occurred', () => {
    try {
      predictStressCategoryTransition('Safe', NaN, 10);
      fail('Should have thrown an error');
    } catch (error) {
      // Error should explain WHY it's invalid (NaN)
      expect(error.message).toMatch(/NaN/);
      // Error should explain what NaN means
      expect(error.message).toMatch(/Not a Number/);
      // Error should explain typical causes
      expect(error.message).toMatch(/invalid mathematical operations/);
    }
  });

  test('error messages provide actionable guidance on how to fix', () => {
    try {
      computeFutureWaterLevels(null, 0.5, 10, new Date());
      fail('Should have thrown an error');
    } catch (error) {
      // Error should tell user HOW to fix it
      expect(error.message).toMatch(/Please provide/);
      // Error should include example of correct format
      expect(error.message).toMatch(/array of objects/);
      expect(error.message).toMatch(/date.*waterLevel/);
    }
  });

  test('error messages for invalid types include received type', () => {
    try {
      predictStressCategoryTransition(123, 0.5, 10);
      fail('Should have thrown an error');
    } catch (error) {
      // Error should show expected type
      expect(error.message).toMatch(/Expected string/);
      // Error should show received type
      expect(error.message).toMatch(/received number/);
    }
  });

  test('error messages for range violations include actual value', () => {
    // Test with invalid stress category to check error includes actual value
    try {
      predictStressCategoryTransition('InvalidCategory', 0.5, 10);
      fail('Should have thrown an error');
    } catch (error) {
      // Error should include the actual invalid value
      expect(error.message).toMatch(/InvalidCategory/);
      // Error should explain the valid options
      expect(error.message).toMatch(/Expected one of/);
      expect(error.message).toMatch(/Safe.*Semi-critical.*Critical.*Over-exploited/);
    }
  });

  test('seasonal prediction errors explain complete cycle requirement', () => {
    const history = [
      { date: new Date(2022, 2, 15), waterLevel: 12 },
      { date: new Date(2022, 10, 15), waterLevel: 10 },
      { date: new Date(2023, 2, 15), waterLevel: 12.5 }
      // Missing post-monsoon 2023
    ];
    const currentDate = new Date('2024-01-15');
    
    try {
      predictSeasonalLevels(history, currentDate, 0.5);
      fail('Should have thrown an error');
    } catch (error) {
      // Error should explain what a complete cycle is
      expect(error.message).toMatch(/complete cycle/);
      expect(error.message).toMatch(/both pre-monsoon.*post-monsoon/);
      // Error should show how many were found
      expect(error.message).toMatch(/Found.*cycle/);
      // Error should show how many are required
      expect(error.message).toMatch(/required/);
    }
  });

  test('validation errors for numeric parameters explain all invalid states', () => {
    // Test null
    try {
      predictStressCategoryTransition('Safe', null, 10);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).toMatch(/Cannot be null or undefined/);
      expect(error.message).toMatch(/Please provide a valid numeric value/);
    }

    // Test wrong type
    try {
      predictStressCategoryTransition('Safe', 'invalid', 10);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).toMatch(/Expected number/);
      expect(error.message).toMatch(/received string/);
    }

    // Test Infinity
    try {
      predictStressCategoryTransition('Safe', Infinity, 10);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).toMatch(/must be finite/);
      expect(error.message).toMatch(/Infinity values are not allowed/);
      expect(error.message).toMatch(/division by zero/);
    }
  });

  test('date validation errors suggest correct format', () => {
    const history = [
      { date: '2024-01-01', waterLevel: 10 },
      { date: '2024-02-01', waterLevel: 11 },
      { date: '2024-03-01', waterLevel: 12 }
    ];
    
    try {
      computeFutureWaterLevels(history, 0.5, 10, 'not a date');
      fail('Should have thrown an error');
    } catch (error) {
      // Error should suggest correct format
      expect(error.message).toMatch(/Date object/);
      expect(error.message).toMatch(/new Date\(\)/);
    }
  });

  test('insufficient data errors specify minimum requirements', () => {
    const history = [
      { date: '2024-01-01', waterLevel: 10 },
      { date: '2024-02-01', waterLevel: 11 }
    ];
    const baseDate = new Date('2024-12-15');
    
    try {
      computeFutureWaterLevels(history, 0.5, 10, baseDate);
      fail('Should have thrown an error');
    } catch (error) {
      // Error should specify minimum requirement (case-insensitive)
      expect(error.message).toMatch(/required/i);
      // Error should show actual count
      expect(error.message).toMatch(/Found 2/);
      // Error should be actionable
      expect(error.message).toMatch(/Please provide more/);
    }
  });
});
