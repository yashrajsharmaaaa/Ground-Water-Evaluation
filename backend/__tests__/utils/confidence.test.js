/**
 * Unit tests for confidence calculation
 */

import { describe, test, expect } from '@jest/globals';
import { calculateConfidence } from '../../utils/predictions.js';

describe('calculateConfidence', () => {
  test('returns "high" for R² > 0.7, data span > 5 years, and >= 20 points', () => {
    const history = Array(25).fill({ date: new Date(), waterLevel: 10 });
    const result = calculateConfidence(history, 0.8, 6);
    expect(result).toBe('high');
  });

  test('returns "medium" for R² > 0.5, data span > 2 years', () => {
    const history = Array(15).fill({ date: new Date(), waterLevel: 10 });
    const result = calculateConfidence(history, 0.6, 3);
    expect(result).toBe('medium');
  });

  test('returns "low" for R² <= 0.5', () => {
    const history = Array(25).fill({ date: new Date(), waterLevel: 10 });
    const result = calculateConfidence(history, 0.4, 6);
    expect(result).toBe('low');
  });

  test('returns "low" for data span <= 2 years even with high R²', () => {
    const history = Array(25).fill({ date: new Date(), waterLevel: 10 });
    const result = calculateConfidence(history, 0.8, 1.5);
    expect(result).toBe('low');
  });

  test('cannot return "high" with fewer than 20 data points (Requirement 5.2)', () => {
    const history = Array(15).fill({ date: new Date(), waterLevel: 10 });
    const result = calculateConfidence(history, 0.8, 6);
    expect(result).not.toBe('high');
    expect(result).toBe('medium');
  });

  test('cannot return "high" with data span < 2 years (Requirement 5.3)', () => {
    const history = Array(25).fill({ date: new Date(), waterLevel: 10 });
    const result = calculateConfidence(history, 0.8, 1.5);
    expect(result).not.toBe('high');
    expect(result).toBe('low');
  });

  test('handles edge case: exactly 20 points and exactly 2 years', () => {
    const history = Array(20).fill({ date: new Date(), waterLevel: 10 });
    const result = calculateConfidence(history, 0.8, 2);
    // Should be low because data span must be > 2 years (not >=)
    expect(result).toBe('low');
  });

  test('handles edge case: R² exactly 0.7', () => {
    const history = Array(25).fill({ date: new Date(), waterLevel: 10 });
    const result = calculateConfidence(history, 0.7, 6);
    // R² must be > 0.7, not >= 0.7
    expect(result).toBe('medium');
  });

  test('handles edge case: R² exactly 0.5', () => {
    const history = Array(15).fill({ date: new Date(), waterLevel: 10 });
    const result = calculateConfidence(history, 0.5, 3);
    // R² must be > 0.5, not >= 0.5
    expect(result).toBe('low');
  });

  test('throws error for invalid history input', () => {
    // ERROR FIX: Updated to match enhanced error messages that include context
    expect(() => calculateConfidence(null, 0.8, 5)).toThrow(/Invalid history parameter.*Expected an array/);
    expect(() => calculateConfidence('not an array', 0.8, 5)).toThrow(/Invalid history parameter.*Expected an array/);
  });

  test('throws error for invalid rSquared input', () => {
    const history = Array(25).fill({ date: new Date(), waterLevel: 10 });
    expect(() => calculateConfidence(history, 'invalid', 5)).toThrow('rSquared');
    expect(() => calculateConfidence(history, NaN, 5)).toThrow('rSquared');
  });

  test('throws error for invalid dataSpanYears input', () => {
    const history = Array(25).fill({ date: new Date(), waterLevel: 10 });
    expect(() => calculateConfidence(history, 0.8, 'invalid')).toThrow('dataSpanYears');
    expect(() => calculateConfidence(history, 0.8, NaN)).toThrow('dataSpanYears');
  });

  test('throws error for R² out of range', () => {
    const history = Array(25).fill({ date: new Date(), waterLevel: 10 });
    // ERROR FIX: Updated to match enhanced error messages that include context
    expect(() => calculateConfidence(history, 1.5, 5)).toThrow(/Invalid rSquared value.*must be between 0 and 1/);
    expect(() => calculateConfidence(history, -0.1, 5)).toThrow(/Invalid rSquared value.*must be between 0 and 1/);
  });

  test('throws error for negative data span', () => {
    const history = Array(25).fill({ date: new Date(), waterLevel: 10 });
    // ERROR FIX: Updated to match enhanced error messages that include context
    expect(() => calculateConfidence(history, 0.8, -1)).toThrow(/Invalid dataSpanYears.*must be non-negative/);
  });

  test('handles empty history array', () => {
    const history = [];
    const result = calculateConfidence(history, 0.8, 5);
    // With 0 points (< 20), cannot be high, but can be medium if R² > 0.5 and span > 2
    expect(result).toBe('medium');
  });

  test('handles very high R² (0.95) with sufficient data', () => {
    const history = Array(50).fill({ date: new Date(), waterLevel: 10 });
    const result = calculateConfidence(history, 0.95, 10);
    expect(result).toBe('high');
  });

  test('handles very low R² (0.1)', () => {
    const history = Array(50).fill({ date: new Date(), waterLevel: 10 });
    const result = calculateConfidence(history, 0.1, 10);
    expect(result).toBe('low');
  });
});
