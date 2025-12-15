/**
 * Tests for statistical utilities module
 */
import { calculateRSquared, calculateStandardError } from '../../utils/statistics.js';

describe('Statistical Utilities', () => {
  describe('calculateRSquared', () => {
    test('returns 1 for perfect fit', () => {
      const actual = [1, 2, 3, 4, 5];
      const predicted = [1, 2, 3, 4, 5];
      const rSquared = calculateRSquared(actual, predicted);
      expect(rSquared).toBe(1);
    });

    test('returns 0 for no correlation', () => {
      const actual = [1, 2, 3, 4, 5];
      const mean = 3;
      const predicted = [mean, mean, mean, mean, mean];
      const rSquared = calculateRSquared(actual, predicted);
      expect(rSquared).toBeCloseTo(0, 5);
    });

    test('returns value between 0 and 1 for partial fit', () => {
      const actual = [1, 2, 3, 4, 5];
      const predicted = [1.1, 2.2, 2.9, 3.8, 5.1];
      const rSquared = calculateRSquared(actual, predicted);
      expect(rSquared).toBeGreaterThan(0);
      expect(rSquared).toBeLessThan(1);
    });

    test('throws error for mismatched array lengths', () => {
      const actual = [1, 2, 3];
      const predicted = [1, 2];
      expect(() => calculateRSquared(actual, predicted)).toThrow('same length');
    });

    test('throws error for empty arrays', () => {
      expect(() => calculateRSquared([], [])).toThrow('cannot be empty');
    });

    test('throws error for non-array inputs', () => {
      expect(() => calculateRSquared(null, [1, 2, 3])).toThrow('must be arrays');
      expect(() => calculateRSquared([1, 2, 3], null)).toThrow('must be arrays');
    });

    test('throws error for null values in arrays', () => {
      const actual = [1, null, 3];
      const predicted = [1, 2, 3];
      expect(() => calculateRSquared(actual, predicted)).toThrow('Invalid value');
    });

    test('throws error for NaN values in arrays', () => {
      const actual = [1, 2, 3];
      const predicted = [1, NaN, 3];
      expect(() => calculateRSquared(actual, predicted)).toThrow('Invalid value');
    });

    test('handles all identical actual values', () => {
      const actual = [5, 5, 5, 5, 5];
      const predicted = [4, 5, 6, 5, 5];
      const rSquared = calculateRSquared(actual, predicted);
      expect(rSquared).toBe(0);
    });
  });

  describe('calculateStandardError', () => {
    test('returns 0 for perfect fit', () => {
      const actual = [1, 2, 3, 4, 5];
      const predicted = [1, 2, 3, 4, 5];
      const se = calculateStandardError(actual, predicted);
      expect(se).toBe(0);
    });

    test('returns positive value for imperfect fit', () => {
      const actual = [1, 2, 3, 4, 5];
      const predicted = [1.1, 2.2, 2.9, 3.8, 5.1];
      const se = calculateStandardError(actual, predicted);
      expect(se).toBeGreaterThan(0);
    });

    test('throws error for fewer than 3 data points', () => {
      const actual = [1, 2];
      const predicted = [1, 2];
      expect(() => calculateStandardError(actual, predicted)).toThrow('at least 3 data points');
    });

    test('throws error for mismatched array lengths', () => {
      const actual = [1, 2, 3, 4];
      const predicted = [1, 2, 3];
      expect(() => calculateStandardError(actual, predicted)).toThrow('same length');
    });

    test('throws error for empty arrays', () => {
      expect(() => calculateStandardError([], [])).toThrow('cannot be empty');
    });

    test('throws error for non-array inputs', () => {
      expect(() => calculateStandardError(null, [1, 2, 3])).toThrow('must be arrays');
      expect(() => calculateStandardError([1, 2, 3], null)).toThrow('must be arrays');
    });

    test('throws error for null values in arrays', () => {
      const actual = [1, 2, null, 4];
      const predicted = [1, 2, 3, 4];
      expect(() => calculateStandardError(actual, predicted)).toThrow('Invalid value');
    });

    test('throws error for NaN values in arrays', () => {
      const actual = [1, 2, 3, 4];
      const predicted = [1, NaN, 3, 4];
      expect(() => calculateStandardError(actual, predicted)).toThrow('Invalid value');
    });

    test('calculates correct standard error for known values', () => {
      // Using simple values where we can calculate SE manually
      // actual = [1, 2, 3], predicted = [1, 2, 3] -> SE = 0
      const actual = [1, 2, 4];
      const predicted = [1, 2, 3];
      // Residuals: [0, 0, 1]
      // Sum of squared residuals: 1
      // SE = sqrt(1 / (3-2)) = sqrt(1) = 1
      const se = calculateStandardError(actual, predicted);
      expect(se).toBeCloseTo(1, 5);
    });
  });
});
