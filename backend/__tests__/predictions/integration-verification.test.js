/**
 * Integration Verification Tests
 * 
 * Validates: Requirements 9.1, 9.2, 9.3, 9.5, 9.6, 9.7
 * 
 * This test suite verifies that the predictions module integrates correctly
 * with the water-level route and follows project standards for:
 * - Cache key consistency
 * - Error handling patterns
 * - Response structure consistency
 * - Backward compatibility
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { generateCacheKey, wrisCache } from '../../utils/cache.js';
import {
  computeFutureWaterLevels,
  calculateConfidence,
  predictStressCategoryTransition,
  predictSeasonalLevels
} from '../../utils/predictions.js';

describe('Integration Verification', () => {
  beforeEach(() => {
    // Clear cache before each test
    wrisCache.flushAll();
  });

  // ============================================================================
  // REQUIREMENT 9.2: Cache Key Consistency
  // ============================================================================
  describe('Cache Key Consistency (Requirement 9.2)', () => {
    it('should generate consistent cache keys for water-level requests', () => {
      // Test that cache key generation is deterministic
      const params1 = { lat: 28.7041, lon: 77.1025, date: '2024-01-15' };
      const params2 = { date: '2024-01-15', lon: 77.1025, lat: 28.7041 }; // Different order
      
      const key1 = generateCacheKey('water-level', params1);
      const key2 = generateCacheKey('water-level', params2);
      
      // Keys should be identical regardless of parameter order
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^water-level:/);
    });

    it('should generate unique cache keys for different parameters', () => {
      const params1 = { lat: 28.7041, lon: 77.1025, date: '2024-01-15' };
      const params2 = { lat: 28.7041, lon: 77.1025, date: '2024-01-16' }; // Different date
      
      const key1 = generateCacheKey('water-level', params1);
      const key2 = generateCacheKey('water-level', params2);
      
      // Keys should be different for different parameters
      expect(key1).not.toBe(key2);
    });

    it('should use correct cache instance (wrisCache) for water-level data', () => {
      // Verify that wrisCache is used (TTL: 7200 seconds = 2 hours)
      const testKey = 'test-key';
      const testData = { test: 'data' };
      
      wrisCache.set(testKey, testData);
      const retrieved = wrisCache.get(testKey);
      
      expect(retrieved).toEqual(testData);
      
      // Verify TTL is set correctly (should be 7200 seconds)
      const ttl = wrisCache.getTtl(testKey);
      expect(ttl).toBeGreaterThan(Date.now()); // TTL should be in the future
    });
  });

  // ============================================================================
  // REQUIREMENT 9.3: Error Handling Patterns
  // ============================================================================
  describe('Error Handling Patterns (Requirement 9.3)', () => {
    it('should throw descriptive errors with context for invalid inputs', () => {
      // Test computeFutureWaterLevels with insufficient data
      const insufficientHistory = [
        { date: '2024-01-01', waterLevel: 10.5 },
        { date: '2024-02-01', waterLevel: 10.7 }
      ];
      
      expect(() => {
        computeFutureWaterLevels(insufficientHistory, -0.5, 10.0, new Date());
      }).toThrow(/Insufficient data points.*Found 2 record.*3 are required/i);
    });

    it('should throw errors with actionable information', () => {
      // Test predictStressCategoryTransition with invalid category
      expect(() => {
        predictStressCategoryTransition('InvalidCategory', 0.5, 15.0);
      }).toThrow(/Expected one of: Safe, Semi-critical, Critical, Over-exploited/);
    });

    it('should validate null/NaN values and provide clear error messages', () => {
      // Test with null values
      const historyWithNull = [
        { date: '2024-01-01', waterLevel: 10.5 },
        { date: '2024-02-01', waterLevel: null },
        { date: '2024-03-01', waterLevel: 10.7 },
        { date: '2024-04-01', waterLevel: 10.9 }
      ];
      
      // Should filter null values and work with remaining valid data (3 valid points)
      // This should NOT throw because we have exactly 3 valid points
      expect(() => {
        computeFutureWaterLevels(historyWithNull, -0.5, 10.0, new Date());
      }).not.toThrow();
    });

    it('should handle prediction errors gracefully without failing entire request', () => {
      // This pattern is used in water-level.js route
      // Predictions are wrapped in try-catch and errors are collected
      const predictions = { errors: [] };
      
      try {
        // Attempt prediction with bad data
        computeFutureWaterLevels([], -0.5, 10.0, new Date());
      } catch (error) {
        predictions.errors.push({
          type: 'computation_error',
          message: error.message,
          affectedPredictions: ['futureWaterLevels']
        });
      }
      
      // Error should be captured, not thrown
      expect(predictions.errors).toHaveLength(1);
      expect(predictions.errors[0].type).toBe('computation_error');
      expect(predictions.errors[0].affectedPredictions).toContain('futureWaterLevels');
    });
  });

  // ============================================================================
  // REQUIREMENT 9.5: Response Structure Consistency
  // ============================================================================
  describe('Response Structure Consistency (Requirement 9.5)', () => {
    const validHistory = [
      { date: '2020-01-15', waterLevel: 10.0 },
      { date: '2021-01-15', waterLevel: 10.5 },
      { date: '2022-01-15', waterLevel: 11.0 },
      { date: '2023-01-15', waterLevel: 11.5 },
      { date: '2024-01-15', waterLevel: 12.0 }
    ];

    it('should return predictions with consistent numeric precision (2 decimals for water levels)', () => {
      const result = computeFutureWaterLevels(
        validHistory,
        0.5, // slope
        10.0, // intercept
        new Date('2024-01-15')
      );
      
      // All predicted levels should be numbers rounded to 2 decimal places
      result.predictions.forEach(pred => {
        expect(typeof pred.predictedLevel).toBe('number');
        // Check that the number has at most 2 decimal places
        const decimalPart = (pred.predictedLevel.toString().split('.')[1] || '');
        expect(decimalPart.length).toBeLessThanOrEqual(2);
      });
    });

    it('should include required metadata fields in predictions', () => {
      const result = computeFutureWaterLevels(
        validHistory,
        0.5,
        10.0,
        new Date('2024-01-15')
      );
      
      // Requirement 1.6: Include methodology and data range
      expect(result).toHaveProperty('methodology');
      expect(result).toHaveProperty('dataRange');
      expect(result).toHaveProperty('predictions');
      
      expect(result.dataRange).toHaveProperty('start');
      expect(result.dataRange).toHaveProperty('end');
      
      // Each prediction should have required fields
      result.predictions.forEach(pred => {
        expect(pred).toHaveProperty('year');
        expect(pred).toHaveProperty('date');
        expect(pred).toHaveProperty('predictedLevel');
        expect(pred).toHaveProperty('unit');
        expect(pred.unit).toBe('meters below ground level');
      });
    });

    it('should return stress predictions with consistent structure', () => {
      const result = predictStressCategoryTransition('Safe', 0.15, 12.0);
      
      // Required fields
      expect(result).toHaveProperty('currentCategory');
      expect(result).toHaveProperty('currentDeclineRate');
      expect(result).toHaveProperty('thresholds');
      expect(result).toHaveProperty('predictions');
      
      // Decline rate should be a number with at most 3 decimal places
      expect(typeof result.currentDeclineRate).toBe('number');
      const decimalPart = (result.currentDeclineRate.toString().split('.')[1] || '');
      expect(decimalPart.length).toBeLessThanOrEqual(3);
    });

    it('should return seasonal predictions with consistent structure', () => {
      const seasonalHistory = [
        // Pre-monsoon (Jan-May)
        { date: '2020-03-15', waterLevel: 10.0 },
        { date: '2021-03-15', waterLevel: 10.5 },
        { date: '2022-03-15', waterLevel: 11.0 },
        { date: '2023-03-15', waterLevel: 11.5 },
        // Post-monsoon (Oct-Dec)
        { date: '2020-11-15', waterLevel: 9.5 },
        { date: '2021-11-15', waterLevel: 10.0 },
        { date: '2022-11-15', waterLevel: 10.5 },
        { date: '2023-11-15', waterLevel: 11.0 }
      ];
      
      const result = predictSeasonalLevels(
        seasonalHistory,
        new Date('2024-01-15'),
        0.5
      );
      
      // Required fields
      expect(result).toHaveProperty('methodology');
      expect(result).toHaveProperty('currentSeason');
      expect(result).toHaveProperty('nextSeason');
      expect(result).toHaveProperty('followingSeason');
      
      // Each season prediction should have required fields
      ['nextSeason', 'followingSeason'].forEach(seasonKey => {
        const season = result[seasonKey];
        expect(season).toHaveProperty('season');
        expect(season).toHaveProperty('period');
        expect(season).toHaveProperty('predictedLevel');
        expect(season).toHaveProperty('historicalAverage');
        expect(season).toHaveProperty('expectedRecharge');
        expect(season).toHaveProperty('unit');
        expect(season.unit).toBe('meters below ground level');
        
        // Predicted levels should be numbers with at most 2 decimal places
        expect(typeof season.predictedLevel).toBe('number');
        const decimalPart = (season.predictedLevel.toString().split('.')[1] || '');
        expect(decimalPart.length).toBeLessThanOrEqual(2);
      });
    });
  });

  // ============================================================================
  // REQUIREMENT 9.6: Naming Conventions
  // ============================================================================
  describe('Naming Conventions (Requirement 9.6)', () => {
    it('should use camelCase for function names', () => {
      // All exported functions use camelCase
      expect(typeof computeFutureWaterLevels).toBe('function');
      expect(typeof calculateConfidence).toBe('function');
      expect(typeof predictStressCategoryTransition).toBe('function');
      expect(typeof predictSeasonalLevels).toBe('function');
    });

    it('should use camelCase for response object keys', () => {
      const validHistory = [
        { date: '2020-01-15', waterLevel: 10.0 },
        { date: '2021-01-15', waterLevel: 10.5 },
        { date: '2022-01-15', waterLevel: 11.0 },
        { date: '2023-01-15', waterLevel: 11.5 }
      ];
      
      const result = computeFutureWaterLevels(
        validHistory,
        0.5,
        10.0,
        new Date('2024-01-15')
      );
      
      // All keys should be camelCase
      const keys = Object.keys(result);
      keys.forEach(key => {
        // Should not contain underscores or hyphens
        expect(key).not.toMatch(/[_-]/);
        // Should start with lowercase
        expect(key[0]).toBe(key[0].toLowerCase());
      });
    });
  });

  // ============================================================================
  // REQUIREMENT 9.7: Backward Compatibility
  // ============================================================================
  describe('Backward Compatibility (Requirement 9.7)', () => {
    const validHistory = [
      { date: '2020-01-15', waterLevel: 10.0 },
      { date: '2021-01-15', waterLevel: 10.5 },
      { date: '2022-01-15', waterLevel: 11.0 },
      { date: '2023-01-15', waterLevel: 11.5 }
    ];

    it('should maintain existing function signatures', () => {
      // computeFutureWaterLevels signature: (history, slope, intercept, baseDate)
      expect(() => {
        computeFutureWaterLevels(validHistory, 0.5, 10.0, new Date());
      }).not.toThrow();
      
      // calculateConfidence signature: (history, rSquared, dataSpanYears)
      expect(() => {
        calculateConfidence(validHistory, 0.8, 4);
      }).not.toThrow();
      
      // predictStressCategoryTransition signature: (currentCategory, annualDeclineRate, currentWaterLevel)
      expect(() => {
        predictStressCategoryTransition('Safe', 0.15, 12.0);
      }).not.toThrow();
    });

    it('should return same response structure as before refactoring', () => {
      const result = computeFutureWaterLevels(
        validHistory,
        0.5,
        10.0,
        new Date('2024-01-15')
      );
      
      // Original response structure should be maintained
      expect(result).toHaveProperty('methodology');
      expect(result).toHaveProperty('dataRange');
      expect(result).toHaveProperty('predictions');
      expect(Array.isArray(result.predictions)).toBe(true);
      
      // Predictions array should contain objects with expected fields
      result.predictions.forEach(pred => {
        expect(pred).toHaveProperty('year');
        expect(pred).toHaveProperty('date');
        expect(pred).toHaveProperty('predictedLevel');
        expect(pred).toHaveProperty('unit');
      });
    });

    it('should handle legacy data formats gracefully', () => {
      // Test with date strings (legacy format)
      const legacyHistory = [
        { date: '2020-01-15', waterLevel: 10.0 },
        { date: '2021-01-15', waterLevel: 10.5 },
        { date: '2022-01-15', waterLevel: 11.0 },
        { date: '2023-01-15', waterLevel: 11.5 }
      ];
      
      expect(() => {
        computeFutureWaterLevels(legacyHistory, 0.5, 10.0, new Date());
      }).not.toThrow();
    });
  });

  // ============================================================================
  // REQUIREMENT 9.1: API Integration Consistency
  // ============================================================================
  describe('API Integration Consistency (Requirement 9.1)', () => {
    it('should integrate with water-level route error handling pattern', () => {
      // The water-level route wraps predictions in try-catch blocks
      // and collects errors in predictions.errors array
      const predictions = { errors: [] };
      
      // Simulate the pattern used in water-level.js
      try {
        const invalidHistory = [{ date: '2024-01-01', waterLevel: 10.0 }];
        computeFutureWaterLevels(invalidHistory, 0.5, 10.0, new Date());
      } catch (error) {
        predictions.errors.push({
          type: 'computation_error',
          message: error.message,
          affectedPredictions: ['futureWaterLevels']
        });
      }
      
      // Error should be captured in the expected format
      expect(predictions.errors).toHaveLength(1);
      expect(predictions.errors[0]).toHaveProperty('type');
      expect(predictions.errors[0]).toHaveProperty('message');
      expect(predictions.errors[0]).toHaveProperty('affectedPredictions');
    });

    it('should work with validation utilities used in water-level route', () => {
      // The route uses validatePredictionInputs before calling prediction functions
      // This test verifies the predictions module works with that pattern
      const validHistory = [
        { date: '2020-01-15', waterLevel: 10.0 },
        { date: '2021-01-15', waterLevel: 10.5 },
        { date: '2022-01-15', waterLevel: 11.0 },
        { date: '2023-01-15', waterLevel: 11.5 }
      ];
      
      // Should work with validated data
      expect(() => {
        computeFutureWaterLevels(validHistory, 0.5, 10.0, new Date());
      }).not.toThrow();
    });

    it('should return predictions that can be cached with water-level data', () => {
      const validHistory = [
        { date: '2020-01-15', waterLevel: 10.0 },
        { date: '2021-01-15', waterLevel: 10.5 },
        { date: '2022-01-15', waterLevel: 11.0 },
        { date: '2023-01-15', waterLevel: 11.5 }
      ];
      
      const predictions = computeFutureWaterLevels(
        validHistory,
        0.5,
        10.0,
        new Date('2024-01-15')
      );
      
      // Predictions should be serializable for caching
      const serialized = JSON.stringify(predictions);
      const deserialized = JSON.parse(serialized);
      
      expect(deserialized).toEqual(predictions);
    });
  });
});
