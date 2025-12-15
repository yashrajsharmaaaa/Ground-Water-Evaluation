/**
 * Tests for data generators to ensure they produce valid data
 */

import { describe, test, expect } from '@jest/globals';
import fc from 'fast-check';
import {
  historicalDataGenerator,
  rechargePatternGenerator,
  stressCategoryGenerator,
  declineRateGenerator,
  regressionParamsGenerator,
  rSquaredGenerator,
  dateGenerator,
  preMonsoonDateGenerator,
  postMonsoonDateGenerator,
  waterLevelGenerator,
  dataSpanYearsGenerator,
  confidenceLevelGenerator,
  predictionHorizonGenerator,
  predictionInputGenerator
} from './generators.js';

describe('Data Generators Validation', () => {
  test('historicalDataGenerator produces sorted chronological data', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 3, maxLength: 10 }),
        (history) => {
          // Check array is not empty
          expect(history.length).toBeGreaterThanOrEqual(3);
          
          // Check chronological order
          for (let i = 1; i < history.length; i++) {
            expect(new Date(history[i].date).getTime()).toBeGreaterThanOrEqual(
              new Date(history[i - 1].date).getTime()
            );
          }
          
          // Check all values are valid
          history.forEach(item => {
            expect(item.date).toBeInstanceOf(Date);
            expect(typeof item.waterLevel).toBe('number');
            expect(isNaN(item.waterLevel)).toBe(false);
            expect(item.waterLevel).toBeGreaterThanOrEqual(0);
            expect(item.waterLevel).toBeLessThanOrEqual(50);
          });
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('rechargePatternGenerator produces consistent recharge amounts', () => {
    fc.assert(
      fc.property(
        rechargePatternGenerator({ minYears: 3, maxYears: 5 }),
        (pattern) => {
          expect(pattern.length).toBeGreaterThanOrEqual(3);
          
          pattern.forEach(item => {
            expect(typeof item.year).toBe('number');
            expect(typeof item.preMonsoonDepth).toBe('number');
            expect(typeof item.postMonsoonDepth).toBe('number');
            expect(typeof item.rechargeAmount).toBe('number');
            
            // Recharge amount should equal difference
            const expectedRecharge = item.preMonsoonDepth - item.postMonsoonDepth;
            expect(Math.abs(item.rechargeAmount - expectedRecharge)).toBeLessThan(0.001);
          });
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('stressCategoryGenerator produces valid categories', () => {
    fc.assert(
      fc.property(
        stressCategoryGenerator(),
        (category) => {
          const validCategories = ['Safe', 'Semi-critical', 'Critical', 'Over-exploited'];
          expect(validCategories).toContain(category);
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  test('declineRateGenerator produces valid rates', () => {
    fc.assert(
      fc.property(
        declineRateGenerator(),
        (rate) => {
          expect(typeof rate).toBe('number');
          expect(isNaN(rate)).toBe(false);
          expect(isFinite(rate)).toBe(true);
          expect(rate).toBeGreaterThanOrEqual(-2);
          expect(rate).toBeLessThanOrEqual(3);
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('regressionParamsGenerator produces valid parameters', () => {
    fc.assert(
      fc.property(
        regressionParamsGenerator(),
        (params) => {
          expect(typeof params.slope).toBe('number');
          expect(typeof params.intercept).toBe('number');
          expect(isNaN(params.slope)).toBe(false);
          expect(isNaN(params.intercept)).toBe(false);
          expect(isFinite(params.slope)).toBe(true);
          expect(isFinite(params.intercept)).toBe(true);
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('rSquaredGenerator produces values between 0 and 1', () => {
    fc.assert(
      fc.property(
        rSquaredGenerator(),
        (rSquared) => {
          expect(typeof rSquared).toBe('number');
          expect(rSquared).toBeGreaterThanOrEqual(0);
          expect(rSquared).toBeLessThanOrEqual(1);
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('preMonsoonDateGenerator produces dates in Jan-May', () => {
    fc.assert(
      fc.property(
        preMonsoonDateGenerator(2024),
        (date) => {
          const month = date.getMonth() + 1; // 1-12
          expect(month).toBeGreaterThanOrEqual(1);
          expect(month).toBeLessThanOrEqual(5);
          expect(date.getFullYear()).toBe(2024);
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('postMonsoonDateGenerator produces dates in Oct-Dec', () => {
    fc.assert(
      fc.property(
        postMonsoonDateGenerator(2024),
        (date) => {
          const month = date.getMonth() + 1; // 1-12
          expect(month).toBeGreaterThanOrEqual(10);
          expect(month).toBeLessThanOrEqual(12);
          expect(date.getFullYear()).toBe(2024);
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('confidenceLevelGenerator produces valid levels', () => {
    fc.assert(
      fc.property(
        confidenceLevelGenerator(),
        (level) => {
          expect(['high', 'medium', 'low']).toContain(level);
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  test('predictionHorizonGenerator produces valid horizons', () => {
    fc.assert(
      fc.property(
        predictionHorizonGenerator(),
        (horizon) => {
          expect([1, 2, 3, 5]).toContain(horizon);
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  test('predictionInputGenerator produces complete valid inputs', () => {
    fc.assert(
      fc.property(
        predictionInputGenerator(),
        (input) => {
          expect(Array.isArray(input.history)).toBe(true);
          expect(input.history.length).toBeGreaterThanOrEqual(3);
          expect(typeof input.slope).toBe('number');
          expect(typeof input.intercept).toBe('number');
          expect(input.baseDate).toBeInstanceOf(Date);
          expect(Array.isArray(input.rechargePattern)).toBe(true);
          expect(typeof input.currentCategory).toBe('string');
          expect(typeof input.annualDeclineRate).toBe('number');
          return true;
        }
      ),
      { numRuns: 30 }
    );
  });
});
