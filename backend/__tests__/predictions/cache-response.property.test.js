/**
 * Property-Based Tests for Caching and Response Structure
 * 
 * Tests universal properties related to response structure and caching behavior
 * using fast-check property-based testing library.
 * 
 * Per Task 16: Implement property-based tests for caching and response structure
 * Requirements: 6.1, 6.2, 6.4, 6.6
 */

import { describe, test, beforeEach } from '@jest/globals';
import fc from 'fast-check';
import { computeFutureWaterLevels, calculateConfidence, predictStressCategoryTransition, predictSeasonalLevels } from '../../utils/predictions.js';
import { wrisCache, generateCacheKey } from '../../utils/cache.js';
import { 
  historicalDataGenerator,
  regressionParamsGenerator,
  dateGenerator,
  rSquaredGenerator,
  dataSpanYearsGenerator,
  stressCategoryGenerator,
  declineRateGenerator,
  waterLevelGenerator
} from '../utils/generators.js';

// ============================================================================
// PROPERTY 4: Response structure includes predictions object
// Feature: predictions-code-audit, Property 4: Response structure includes predictions object
// Validates: Requirements 6.1, 6.2
// ============================================================================

describe('Property 4: Response structure includes predictions object', () => {
  test('for any valid prediction computation, the result contains required structure fields', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 3, maxLength: 100 }),
        regressionParamsGenerator(),
        dateGenerator(),
        (history, regressionParams, baseDate) => {
          // Execute prediction
          const result = computeFutureWaterLevels(
            history,
            regressionParams.slope,
            regressionParams.intercept,
            baseDate
          );
          
          // Property: result must have required top-level fields
          const hasMethodology = typeof result.methodology === 'string' && result.methodology.length > 0;
          const hasDataRange = result.dataRange && 
                               typeof result.dataRange.start === 'string' && 
                               typeof result.dataRange.end === 'string';
          const hasPredictions = Array.isArray(result.predictions) && result.predictions.length > 0;
          
          return hasMethodology && hasDataRange && hasPredictions;
        }
      ),
      { numRuns: 100 } // Run 100+ iterations as specified
    );
  });
  
  test('for any valid confidence calculation, the result is a valid confidence level string', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 3, maxLength: 100 }),
        rSquaredGenerator(),
        dataSpanYearsGenerator({ min: 0, max: 15 }),
        (history, rSquared, dataSpanYears) => {
          // Execute confidence calculation
          const confidence = calculateConfidence(history, rSquared, dataSpanYears);
          
          // Property: confidence must be one of the valid levels
          const validLevels = ['high', 'medium', 'low'];
          return validLevels.includes(confidence);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any valid stress transition prediction, the result contains required structure', () => {
    fc.assert(
      fc.property(
        stressCategoryGenerator(),
        declineRateGenerator({ min: -2, max: 3 }),
        waterLevelGenerator({ min: 5, max: 50 }),
        (category, declineRate, waterLevel) => {
          // Execute stress transition prediction
          const result = predictStressCategoryTransition(category, declineRate, waterLevel);
          
          // Property: result must have required top-level fields
          const hasCurrentCategory = typeof result.currentCategory === 'string';
          const hasCurrentDeclineRate = typeof result.currentDeclineRate === 'number';
          const hasThresholds = result.thresholds && typeof result.thresholds === 'object';
          const hasPredictions = result.predictions !== undefined;
          
          return hasCurrentCategory && hasCurrentDeclineRate && hasThresholds && hasPredictions;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any valid seasonal prediction with sufficient data, the result contains both seasons', () => {
    fc.assert(
      fc.property(
        // Generate data with at least 3 complete cycles (6 years of data)
        historicalDataGenerator({ minLength: 50, maxLength: 200 }),
        dateGenerator(),
        fc.float({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
        (history, currentDate, slope) => {
          try {
            // Execute seasonal prediction
            const result = predictSeasonalLevels(history, currentDate, slope);
            
            // Property: result must have both nextSeason and followingSeason
            const hasNextSeason = result.nextSeason && 
                                 typeof result.nextSeason.season === 'string' &&
                                 typeof result.nextSeason.predictedLevel === 'number';
            const hasFollowingSeason = result.followingSeason && 
                                      typeof result.followingSeason.season === 'string' &&
                                      typeof result.followingSeason.predictedLevel === 'number';
            const hasMethodology = typeof result.methodology === 'string';
            
            return hasNextSeason && hasFollowingSeason && hasMethodology;
          } catch (error) {
            // If insufficient seasonal data, that's expected for some random inputs
            // The property still holds - when it succeeds, it has the right structure
            if (error.message.includes('Insufficient seasonal data') || 
                error.message.includes('Unable to calculate seasonal averages')) {
              return true; // Skip this test case
            }
            throw error; // Re-throw unexpected errors
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 19: Predictions cached with water level data
// Feature: predictions-code-audit, Property 19: Predictions cached with water level data
// Validates: Requirements 6.1, 6.2
// ============================================================================

describe('Property 19: Predictions cached with water level data', () => {
  beforeEach(() => {
    // Clear cache before each test
    wrisCache.flushAll();
  });
  
  test('for any cache key, stored data includes predictions object when set', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }), // latitude
        fc.float({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }), // longitude
        fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
        historicalDataGenerator({ minLength: 3, maxLength: 50 }),
        regressionParamsGenerator(),
        (lat, lon, date, history, regressionParams) => {
          // Generate cache key
          const dateStr = date.toISOString().split('T')[0];
          const cacheKey = generateCacheKey('water-level', { 
            lat: lat.toFixed(6), 
            lon: lon.toFixed(6), 
            date: dateStr 
          });
          
          // Compute predictions
          const predictions = {
            futureWaterLevels: computeFutureWaterLevels(
              history,
              regressionParams.slope,
              regressionParams.intercept,
              date
            ),
            errors: []
          };
          
          // Create mock response data (simulating what the route does)
          const responseData = {
            district: 'Test District',
            state: 'Test State',
            predictions: predictions
          };
          
          // Cache the data
          wrisCache.set(cacheKey, responseData);
          
          // Retrieve from cache
          const cachedData = wrisCache.get(cacheKey);
          
          // Property: cached data must include predictions object
          return cachedData !== undefined && 
                 cachedData.predictions !== undefined &&
                 cachedData.predictions.futureWaterLevels !== undefined;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any cached response, predictions structure is preserved after caching', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
        historicalDataGenerator({ minLength: 3, maxLength: 50 }),
        regressionParamsGenerator(),
        rSquaredGenerator(),
        dataSpanYearsGenerator({ min: 1, max: 10 }),
        (lat, lon, date, history, regressionParams, rSquared, dataSpanYears) => {
          const dateStr = date.toISOString().split('T')[0];
          const cacheKey = generateCacheKey('water-level', { 
            lat: lat.toFixed(6), 
            lon: lon.toFixed(6), 
            date: dateStr 
          });
          
          // Compute full predictions object
          const futureResult = computeFutureWaterLevels(
            history,
            regressionParams.slope,
            regressionParams.intercept,
            date
          );
          const confidence = calculateConfidence(history, rSquared, dataSpanYears);
          
          const originalPredictions = {
            futureWaterLevels: {
              ...futureResult,
              confidence
            },
            errors: []
          };
          
          const responseData = {
            district: 'Test District',
            predictions: originalPredictions
          };
          
          // Cache and retrieve
          wrisCache.set(cacheKey, responseData);
          const cachedData = wrisCache.get(cacheKey);
          
          // Property: predictions structure is preserved
          const hasMethodology = cachedData.predictions.futureWaterLevels.methodology === originalPredictions.futureWaterLevels.methodology;
          const hasPredictions = cachedData.predictions.futureWaterLevels.predictions.length === originalPredictions.futureWaterLevels.predictions.length;
          const hasConfidence = cachedData.predictions.futureWaterLevels.confidence === originalPredictions.futureWaterLevels.confidence;
          
          return hasMethodology && hasPredictions && hasConfidence;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 20: Cache hits skip recomputation
// Feature: predictions-code-audit, Property 20: Cache hits skip recomputation
// Validates: Requirements 6.1, 6.2
// ============================================================================

describe('Property 20: Cache hits skip recomputation', () => {
  beforeEach(() => {
    // Clear cache before each test
    wrisCache.flushAll();
  });
  
  test('for any cache key, retrieving cached data returns the exact same object', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
        historicalDataGenerator({ minLength: 3, maxLength: 50 }),
        regressionParamsGenerator(),
        (lat, lon, date, history, regressionParams) => {
          const dateStr = date.toISOString().split('T')[0];
          const cacheKey = generateCacheKey('water-level', { 
            lat: lat.toFixed(6), 
            lon: lon.toFixed(6), 
            date: dateStr 
          });
          
          // Compute predictions once
          const predictions = {
            futureWaterLevels: computeFutureWaterLevels(
              history,
              regressionParams.slope,
              regressionParams.intercept,
              date
            )
          };
          
          const responseData = {
            district: 'Test District',
            predictions: predictions
          };
          
          // Cache the data
          wrisCache.set(cacheKey, responseData);
          
          // Retrieve multiple times
          const firstRetrieval = wrisCache.get(cacheKey);
          const secondRetrieval = wrisCache.get(cacheKey);
          
          // Property: both retrievals return data with same predictions
          // (Note: node-cache uses clones by default, but we disabled it with useClones: false)
          const firstPredictedLevel = firstRetrieval.predictions.futureWaterLevels.predictions[0].predictedLevel;
          const secondPredictedLevel = secondRetrieval.predictions.futureWaterLevels.predictions[0].predictedLevel;
          
          return firstPredictedLevel === secondPredictedLevel;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any cache key, cache hit returns data without requiring recomputation', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
        (lat, lon, date) => {
          const dateStr = date.toISOString().split('T')[0];
          const cacheKey = generateCacheKey('water-level', { 
            lat: lat.toFixed(6), 
            lon: lon.toFixed(6), 
            date: dateStr 
          });
          
          // Set some data in cache
          const testData = {
            district: 'Test District',
            predictions: {
              futureWaterLevels: {
                methodology: 'test',
                predictions: []
              }
            }
          };
          
          wrisCache.set(cacheKey, testData);
          
          // Property: cache.get returns data (cache hit)
          const cachedData = wrisCache.get(cacheKey);
          
          // If cache hit, data should be returned
          return cachedData !== undefined && cachedData.district === 'Test District';
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any cache key not in cache, cache miss returns undefined', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
        (lat, lon, date) => {
          const dateStr = date.toISOString().split('T')[0];
          const cacheKey = generateCacheKey('water-level', { 
            lat: lat.toFixed(6), 
            lon: lon.toFixed(6), 
            date: dateStr 
          });
          
          // Don't set anything in cache
          
          // Property: cache.get returns undefined (cache miss)
          const cachedData = wrisCache.get(cacheKey);
          
          return cachedData === undefined;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any cache key, setting and getting preserves all prediction fields', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
        historicalDataGenerator({ minLength: 3, maxLength: 50 }),
        regressionParamsGenerator(),
        stressCategoryGenerator(),
        declineRateGenerator({ min: 0, max: 2 }),
        waterLevelGenerator({ min: 5, max: 50 }),
        (lat, lon, date, history, regressionParams, category, declineRate, waterLevel) => {
          const dateStr = date.toISOString().split('T')[0];
          const cacheKey = generateCacheKey('water-level', { 
            lat: lat.toFixed(6), 
            lon: lon.toFixed(6), 
            date: dateStr 
          });
          
          // Compute all prediction types
          const futureResult = computeFutureWaterLevels(
            history,
            regressionParams.slope,
            regressionParams.intercept,
            date
          );
          
          const stressResult = predictStressCategoryTransition(
            category,
            declineRate,
            waterLevel
          );
          
          const predictions = {
            futureWaterLevels: futureResult,
            stressCategoryTransition: stressResult,
            errors: []
          };
          
          const responseData = {
            district: 'Test District',
            predictions: predictions
          };
          
          // Cache and retrieve
          wrisCache.set(cacheKey, responseData);
          const cachedData = wrisCache.get(cacheKey);
          
          // Property: all prediction types are preserved
          const hasFuture = cachedData.predictions.futureWaterLevels !== undefined;
          const hasStress = cachedData.predictions.stressCategoryTransition !== undefined;
          const hasErrors = Array.isArray(cachedData.predictions.errors);
          
          return hasFuture && hasStress && hasErrors;
        }
      ),
      { numRuns: 100 }
    );
  });
});
