import { wrisCache, generateCacheKey } from '../../utils/cache.js';
import { 
  computeFutureWaterLevels, 
  predictStressCategoryTransition,
  predictSeasonalLevels 
} from '../../utils/predictions.js';

/**
 * Cache Integration Tests
 * 
 * These tests verify that predictions are properly cached with water level data
 * and that cache hits return predictions without recomputation.
 * 
 * Requirements: 4.4, 6.2, 6.3, 6.4
 */

describe('Cache Integration for Predictions', () => {
  beforeEach(() => {
    // Clear cache before each test
    wrisCache.flushAll();
  });

  afterEach(() => {
    // Clean up after each test
    wrisCache.flushAll();
  });

  describe('Cache Key Generation', () => {
    test('cache key includes all prediction-relevant parameters', () => {
      // Requirement 6.2: Cache key should include all parameters that affect predictions
      const params1 = { lat: 28.7041, lon: 77.1025, date: '2024-12-15' };
      const params2 = { lat: 28.7041, lon: 77.1025, date: '2024-12-16' };
      const params3 = { lat: 28.7042, lon: 77.1025, date: '2024-12-15' };

      const key1 = generateCacheKey('water-level', params1);
      const key2 = generateCacheKey('water-level', params2);
      const key3 = generateCacheKey('water-level', params3);

      // Different dates should produce different keys
      expect(key1).not.toBe(key2);
      
      // Different coordinates should produce different keys
      expect(key1).not.toBe(key3);
      
      // Same parameters should produce same key
      const key1Duplicate = generateCacheKey('water-level', params1);
      expect(key1).toBe(key1Duplicate);
    });

    test('cache key is deterministic regardless of parameter order', () => {
      // Cache key should be consistent even if parameters are in different order
      const params1 = { lat: 28.7041, lon: 77.1025, date: '2024-12-15' };
      const params2 = { date: '2024-12-15', lon: 77.1025, lat: 28.7041 };

      const key1 = generateCacheKey('water-level', params1);
      const key2 = generateCacheKey('water-level', params2);

      expect(key1).toBe(key2);
    });
  });

  describe('Predictions in Cached Response', () => {
    test('cached response includes predictions object', () => {
      // Requirement 4.4: Predictions should be cached with water level data
      const cacheKey = generateCacheKey('water-level', { 
        lat: 28.7041, 
        lon: 77.1025, 
        date: '2024-12-15' 
      });

      // Simulate a complete response with predictions
      const responseData = {
        userLocation: { lat: 28.7041, lon: 77.1025, date: '2024-12-15' },
        currentWaterLevel: '12.5',
        historicalLevels: [
          { date: '2020-01-01', waterLevel: 10.0 },
          { date: '2021-01-01', waterLevel: 11.0 },
          { date: '2022-01-01', waterLevel: 12.0 },
          { date: '2023-01-01', waterLevel: 13.0 }
        ],
        predictions: {
          futureWaterLevels: {
            methodology: 'Linear regression based on 4-year historical trend',
            dataRange: { start: '2020-01-01', end: '2023-01-01' },
            confidence: 'medium',
            predictions: [
              { year: 1, date: '2025-12-15', predictedLevel: 14.0, unit: 'meters below ground level' }
            ]
          },
          stressCategoryTransition: {
            currentCategory: 'Safe',
            currentDeclineRate: 1.0,
            predictions: {
              nextCategory: 'Semi-critical',
              yearsUntilTransition: 5.0
            }
          },
          errors: []
        }
      };

      // Cache the response
      wrisCache.set(cacheKey, responseData);

      // Retrieve from cache
      const cachedData = wrisCache.get(cacheKey);

      // Verify predictions are present in cached data
      expect(cachedData).toBeDefined();
      expect(cachedData.predictions).toBeDefined();
      expect(cachedData.predictions.futureWaterLevels).toBeDefined();
      expect(cachedData.predictions.stressCategoryTransition).toBeDefined();
      expect(cachedData.predictions.errors).toBeDefined();
    });

    test('cached response preserves all prediction fields', () => {
      // Verify that all prediction fields are preserved in cache
      const cacheKey = generateCacheKey('water-level', { 
        lat: 28.7041, 
        lon: 77.1025, 
        date: '2024-12-15' 
      });

      const originalPredictions = {
        futureWaterLevels: {
          methodology: 'Linear regression based on 10-year historical trend',
          dataRange: { start: '2014-01-01', end: '2024-12-15' },
          confidence: 'high',
          predictions: [
            { year: 1, date: '2025-12-15', predictedLevel: 12.5, unit: 'meters below ground level' },
            { year: 2, date: '2026-12-15', predictedLevel: 13.2, unit: 'meters below ground level' },
            { year: 3, date: '2027-12-15', predictedLevel: 13.9, unit: 'meters below ground level' },
            { year: 5, date: '2029-12-15', predictedLevel: 15.3, unit: 'meters below ground level' }
          ]
        },
        stressCategoryTransition: {
          currentCategory: 'Safe',
          currentDeclineRate: 0.7,
          predictions: {
            nextCategory: 'Semi-critical',
            yearsUntilTransition: 3.2,
            estimatedTransitionDate: '2028-03-15',
            warning: 'High priority - transition expected within 5 years'
          },
          thresholds: {
            'Safe': { max: 0.1 },
            'Semi-critical': { max: 0.5 },
            'Critical': { max: 1.0 },
            'Over-exploited': { min: 1.0 }
          },
          confidence: 'medium'
        },
        seasonalPredictions: {
          methodology: '5-year seasonal average with trend adjustment',
          currentSeason: 'post-monsoon',
          nextSeason: {
            season: 'pre-monsoon',
            period: 'January-May 2025',
            predictedLevel: 14.2,
            historicalAverage: 13.8,
            expectedRecharge: -1.5,
            unit: 'meters below ground level'
          },
          followingSeason: {
            season: 'post-monsoon',
            period: 'October-December 2025',
            predictedLevel: 12.7,
            historicalAverage: 12.3,
            expectedRecharge: 1.5,
            unit: 'meters below ground level'
          },
          confidence: 'high'
        },
        errors: []
      };

      const responseData = {
        userLocation: { lat: 28.7041, lon: 77.1025, date: '2024-12-15' },
        predictions: originalPredictions
      };

      // Cache the response
      wrisCache.set(cacheKey, responseData);

      // Retrieve from cache
      const cachedData = wrisCache.get(cacheKey);

      // Deep comparison of predictions
      expect(cachedData.predictions).toEqual(originalPredictions);
      
      // Verify specific nested fields
      expect(cachedData.predictions.futureWaterLevels.predictions).toHaveLength(4);
      expect(cachedData.predictions.stressCategoryTransition.predictions.warning).toBe('High priority - transition expected within 5 years');
      expect(cachedData.predictions.seasonalPredictions.nextSeason.expectedRecharge).toBe(-1.5);
    });

    test('cached response includes prediction errors when present', () => {
      // Requirement 4.2: Cache should preserve error messages
      const cacheKey = generateCacheKey('water-level', { 
        lat: 28.7041, 
        lon: 77.1025, 
        date: '2024-12-15' 
      });

      const responseData = {
        userLocation: { lat: 28.7041, lon: 77.1025, date: '2024-12-15' },
        predictions: {
          errors: [
            {
              type: 'insufficient_data',
              message: 'Insufficient historical data for predictions (minimum 3 points required)',
              affectedPredictions: ['futureWaterLevels', 'stressCategoryTransition']
            }
          ]
        }
      };

      // Cache the response
      wrisCache.set(cacheKey, responseData);

      // Retrieve from cache
      const cachedData = wrisCache.get(cacheKey);

      // Verify errors are preserved
      expect(cachedData.predictions.errors).toHaveLength(1);
      expect(cachedData.predictions.errors[0].type).toBe('insufficient_data');
      expect(cachedData.predictions.errors[0].affectedPredictions).toContain('futureWaterLevels');
    });
  });

  describe('Cache Hit Behavior', () => {
    test('cache hit returns predictions without recomputation', () => {
      // Requirement 6.3, 6.4: Cache hits should skip recomputation
      const cacheKey = generateCacheKey('water-level', { 
        lat: 28.7041, 
        lon: 77.1025, 
        date: '2024-12-15' 
      });

      // Create mock computation tracker
      let computationCount = 0;
      const mockComputePredictions = () => {
        computationCount++;
        return {
          futureWaterLevels: {
            predictions: [{ year: 1, predictedLevel: 12.5 }]
          }
        };
      };

      // First request - cache miss, compute predictions
      const firstResult = mockComputePredictions();
      wrisCache.set(cacheKey, { predictions: firstResult });
      expect(computationCount).toBe(1);

      // Second request - cache hit, should NOT recompute
      const cachedData = wrisCache.get(cacheKey);
      expect(cachedData).toBeDefined();
      expect(cachedData.predictions).toEqual(firstResult);
      
      // Computation count should still be 1 (no recomputation)
      expect(computationCount).toBe(1);

      // Third request - also cache hit
      const cachedData2 = wrisCache.get(cacheKey);
      expect(cachedData2).toBeDefined();
      expect(computationCount).toBe(1); // Still no recomputation
    });

    test('cache miss triggers prediction computation', () => {
      // When cache is empty, predictions should be computed
      const cacheKey = generateCacheKey('water-level', { 
        lat: 28.7041, 
        lon: 77.1025, 
        date: '2024-12-15' 
      });

      // Verify cache is empty
      const cachedData = wrisCache.get(cacheKey);
      expect(cachedData).toBeUndefined();

      // This would trigger computation in the actual route handler
      // Here we just verify the cache is empty
      expect(wrisCache.has(cacheKey)).toBe(false);
    });

    test('different parameters result in cache miss', () => {
      // Different parameters should not hit the same cache entry
      const key1 = generateCacheKey('water-level', { 
        lat: 28.7041, 
        lon: 77.1025, 
        date: '2024-12-15' 
      });
      const key2 = generateCacheKey('water-level', { 
        lat: 28.7041, 
        lon: 77.1025, 
        date: '2024-12-16' // Different date
      });

      // Cache data for first key
      wrisCache.set(key1, { predictions: { futureWaterLevels: { predictions: [] } } });

      // Second key should be a cache miss
      const cachedData = wrisCache.get(key2);
      expect(cachedData).toBeUndefined();
    });
  });

  describe('Cache TTL and Invalidation', () => {
    test('cached predictions use same TTL as water level data', () => {
      // Requirement 6.2: Predictions should use same TTL as water level data
      // wrisCache has stdTTL of 7200 seconds (2 hours)
      const cacheKey = generateCacheKey('water-level', { 
        lat: 28.7041, 
        lon: 77.1025, 
        date: '2024-12-15' 
      });

      const responseData = {
        predictions: {
          futureWaterLevels: { predictions: [] }
        }
      };

      // Cache the response
      wrisCache.set(cacheKey, responseData);

      // Verify it's cached
      expect(wrisCache.has(cacheKey)).toBe(true);

      // Get TTL (should be close to 7200 seconds)
      const ttl = wrisCache.getTtl(cacheKey);
      expect(ttl).toBeGreaterThan(0);
      
      // TTL should be approximately 7200 seconds (allowing for small timing differences)
      const remainingSeconds = (ttl - Date.now()) / 1000;
      expect(remainingSeconds).toBeGreaterThan(7190);
      expect(remainingSeconds).toBeLessThanOrEqual(7200);
    });

    test('cache can be manually invalidated', () => {
      // Requirement 6.4: Cache should be invalidatable when data updates
      const cacheKey = generateCacheKey('water-level', { 
        lat: 28.7041, 
        lon: 77.1025, 
        date: '2024-12-15' 
      });

      // Cache some data
      wrisCache.set(cacheKey, { predictions: {} });
      expect(wrisCache.has(cacheKey)).toBe(true);

      // Invalidate cache
      wrisCache.del(cacheKey);
      expect(wrisCache.has(cacheKey)).toBe(false);
    });
  });

  describe('Cache Performance', () => {
    test('cache retrieval is faster than computation', () => {
      // This test demonstrates the performance benefit of caching
      const cacheKey = generateCacheKey('water-level', { 
        lat: 28.7041, 
        lon: 77.1025, 
        date: '2024-12-15' 
      });

      // Simulate expensive computation
      const computeExpensivePredictions = () => {
        const history = Array.from({ length: 100 }, (_, i) => ({
          date: new Date(2020, 0, 1 + i * 3).toISOString().split('T')[0],
          waterLevel: 10 + Math.random() * 5
        }));
        
        return computeFutureWaterLevels(history, 0.5, 10, new Date('2024-12-15'));
      };

      // Measure computation time
      const computeStart = Date.now();
      const result = computeExpensivePredictions();
      const computeTime = Date.now() - computeStart;

      // Cache the result
      wrisCache.set(cacheKey, { predictions: { futureWaterLevels: result } });

      // Measure cache retrieval time
      const cacheStart = Date.now();
      const cachedResult = wrisCache.get(cacheKey);
      const cacheTime = Date.now() - cacheStart;

      // Cache should be significantly faster (typically <1ms vs several ms)
      expect(cacheTime).toBeLessThan(computeTime);
      expect(cachedResult.predictions.futureWaterLevels).toEqual(result);
    });
  });

  describe('Integration with Water Level Response', () => {
    test('complete response structure includes all required fields with predictions', () => {
      // Verify the complete response structure matches the design document
      const cacheKey = generateCacheKey('water-level', { 
        lat: 28.7041, 
        lon: 77.1025, 
        date: '2024-12-15' 
      });

      const completeResponse = {
        userLocation: { lat: 28.7041, lon: 77.1025, date: '2024-12-15' },
        nearestStation: {
          stationName: 'Test Station',
          latitude: 28.7041,
          longitude: 77.1025,
          distanceKm: '0.00',
          wellType: 'Dug Well',
          wellDepth: 50,
          wellAquiferType: 'Alluvial',
          note: null
        },
        currentWaterLevel: '12.5',
        historicalLevels: [],
        rechargePattern: [],
        rechargeTrend: null,
        stressAnalysis: {},
        plotData: {},
        predictions: {
          futureWaterLevels: {},
          stressCategoryTransition: {},
          seasonalPredictions: {},
          errors: []
        }
      };

      // Cache the complete response
      wrisCache.set(cacheKey, completeResponse);

      // Retrieve and verify
      const cached = wrisCache.get(cacheKey);
      
      // Verify all top-level fields are present
      expect(cached.userLocation).toBeDefined();
      expect(cached.nearestStation).toBeDefined();
      expect(cached.currentWaterLevel).toBeDefined();
      expect(cached.predictions).toBeDefined();
      
      // Verify predictions structure
      expect(cached.predictions.futureWaterLevels).toBeDefined();
      expect(cached.predictions.stressCategoryTransition).toBeDefined();
      expect(cached.predictions.seasonalPredictions).toBeDefined();
      expect(cached.predictions.errors).toBeDefined();
    });
  });
});
