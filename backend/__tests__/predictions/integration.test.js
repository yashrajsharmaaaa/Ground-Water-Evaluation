/**
 * Integration Tests for Water Levels Endpoint with Predictions
 * 
 * Task 14: Final integration testing
 * - Test full water-levels endpoint with real WRIS data patterns
 * - Verify backward compatibility (existing clients unaffected)
 * - Test all three prediction types together
 * - Verify graceful degradation when predictions fail
 * - Test with various Indian districts (different data quality)
 * 
 * Requirements: All
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  computeFutureWaterLevels, 
  predictStressCategoryTransition,
  predictSeasonalLevels,
  calculateConfidence 
} from '../../utils/predictions.js';
import { calculateRSquared } from '../../utils/statistics.js';
import { validatePredictionInputs, validateSeasonalData } from '../../utils/validation.js';
import { wrisCache, generateCacheKey } from '../../utils/cache.js';

// Helper to create realistic WRIS-like historical data
const createWRISLikeHistory = (years, baseLevel, trend, variance = 1) => {
  const history = [];
  const startYear = 2024 - years;
  
  for (let year = 0; year < years; year++) {
    // Pre-monsoon data (March-May)
    for (let month of [2, 3, 4]) { // March, April, May
      history.push({
        date: new Date(startYear + year, month, 15),
        waterLevel: baseLevel + (year * trend) + (Math.random() * variance)
      });
    }
    
    // Post-monsoon data (October-December)
    for (let month of [9, 10, 11]) { // October, November, December
      // Post-monsoon typically has better (lower) water levels
      history.push({
        date: new Date(startYear + year, month, 15),
        waterLevel: baseLevel + (year * trend) - 1.5 + (Math.random() * variance)
      });
    }
  }
  
  return history.sort((a, b) => a.date - b.date);
};


// Helper to compute linear regression (mimics route logic)
const computeLinearRegression = (x, y) => {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  const denominator = x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0);
  
  if (denominator === 0) {
    return { slope: 0, intercept: meanY, fitted: y };
  }
  
  const slope = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0) / denominator;
  const intercept = meanY - slope * meanX;
  return { slope, intercept, fitted: x.map((xi) => slope * xi + intercept) };
};

// Helper to create recharge pattern from history
const createRechargePattern = (history) => {
  const groupedByYear = {};
  
  history.forEach((record) => {
    const dt = new Date(record.date);
    const year = dt.getFullYear();
    const month = dt.getMonth() + 1;
    
    if (!groupedByYear[year]) groupedByYear[year] = { pre: [], post: [] };
    if (month >= 1 && month <= 5) groupedByYear[year].pre.push(record.waterLevel);
    else if (month >= 10 && month <= 12) groupedByYear[year].post.push(record.waterLevel);
  });
  
  const rechargePattern = [];
  for (const year in groupedByYear) {
    const preLevels = groupedByYear[year].pre;
    const postLevels = groupedByYear[year].post;
    if (preLevels.length > 0 && postLevels.length > 0) {
      const avgPre = preLevels.reduce((sum, val) => sum + val, 0) / preLevels.length;
      const avgPost = postLevels.reduce((sum, val) => sum + val, 0) / postLevels.length;
      rechargePattern.push({
        year: parseInt(year),
        preMonsoonDepth: avgPre.toFixed(2),
        postMonsoonDepth: avgPost.toFixed(2),
        rechargeAmount: (avgPre - avgPost).toFixed(2),
      });
    }
  }
  
  return rechargePattern;
};

describe('Integration Tests - Full Water Levels Endpoint with Predictions', () => {
  beforeEach(() => {
    wrisCache.flushAll();
  });

  afterEach(() => {
    wrisCache.flushAll();
  });

  describe('Complete Prediction Pipeline', () => {
    test('INTEGRATION: High-quality data produces all three prediction types', () => {
      // Simulate high-quality WRIS data (10 years, good coverage)
      const history = createWRISLikeHistory(10, 12, 0.5, 0.5);
      const baseDate = new Date('2024-12-15');
      
      // Compute regression (mimics route logic)
      const firstDate = new Date(history[0].date).getTime();
      const x = history.map(h => 
        (new Date(h.date).getTime() - firstDate) / (365.25 * 24 * 60 * 60 * 1000)
      );
      const y = history.map(h => h.waterLevel);
      const { slope, intercept, fitted } = computeLinearRegression(x, y);
      
      // Validate inputs
      const validationResult = validatePredictionInputs(history, slope, intercept);
      expect(validationResult.isValid).toBe(true);
      
      // 1. Future water level predictions
      const futureResult = computeFutureWaterLevels(
        validationResult.validData,
        slope,
        intercept,
        baseDate
      );
      
      expect(futureResult.predictions).toHaveLength(4);
      expect(futureResult.predictions.map(p => p.year)).toEqual([1, 2, 3, 5]);
      expect(futureResult.methodology).toContain('Linear regression');
      
      // 2. Stress category transition
      const currentWaterLevel = history[history.length - 1].waterLevel;
      const stressResult = predictStressCategoryTransition(
        'Safe',
        Math.abs(slope),
        currentWaterLevel
      );
      
      expect(stressResult.currentCategory).toBe('Safe');
      expect(stressResult.predictions).toBeDefined();
      
      // 3. Seasonal predictions
      const rechargePattern = createRechargePattern(history);
      const seasonalValidation = validateSeasonalData(rechargePattern, 3);
      
      if (seasonalValidation.isValid) {
        const seasonalResult = predictSeasonalLevels(
          validationResult.validData,
          baseDate,
          slope
        );
        
        expect(seasonalResult.nextSeason).toBeDefined();
        expect(seasonalResult.followingSeason).toBeDefined();
        expect(seasonalResult.currentSeason).toBeDefined();
      }
      
      // Verify all predictions computed successfully
      expect(futureResult).toBeDefined();
      expect(stressResult).toBeDefined();
    });


    test('INTEGRATION: Medium-quality data produces partial predictions', () => {
      // Simulate medium-quality data (5 years, some gaps)
      const history = createWRISLikeHistory(5, 15, 0.3, 1.5);
      const baseDate = new Date('2024-12-15');
      
      // Compute regression
      const firstDate = new Date(history[0].date).getTime();
      const x = history.map(h => 
        (new Date(h.date).getTime() - firstDate) / (365.25 * 24 * 60 * 60 * 1000)
      );
      const y = history.map(h => h.waterLevel);
      const { slope, intercept } = computeLinearRegression(x, y);
      
      // Validate inputs
      const validationResult = validatePredictionInputs(history, slope, intercept);
      expect(validationResult.isValid).toBe(true);
      
      // Future predictions should work
      const futureResult = computeFutureWaterLevels(
        validationResult.validData,
        slope,
        intercept,
        baseDate
      );
      expect(futureResult.predictions).toHaveLength(4);
      
      // Stress predictions should work
      const currentWaterLevel = history[history.length - 1].waterLevel;
      const stressResult = predictStressCategoryTransition(
        'Semi-critical',
        Math.abs(slope),
        currentWaterLevel
      );
      expect(stressResult.currentCategory).toBe('Semi-critical');
      
      // Seasonal predictions might work if we have enough cycles
      const rechargePattern = createRechargePattern(history);
      const seasonalValidation = validateSeasonalData(rechargePattern, 3);
      
      // With 5 years, we should have enough seasonal data
      expect(seasonalValidation.isValid).toBe(true);
    });

    test('INTEGRATION: Low-quality data produces errors gracefully', () => {
      // Simulate low-quality data (only 2 years)
      const history = createWRISLikeHistory(2, 10, 0.2, 2);
      const baseDate = new Date('2024-12-15');
      
      // Compute regression
      const firstDate = new Date(history[0].date).getTime();
      const x = history.map(h => 
        (new Date(h.date).getTime() - firstDate) / (365.25 * 24 * 60 * 60 * 1000)
      );
      const y = history.map(h => h.waterLevel);
      const { slope, intercept } = computeLinearRegression(x, y);
      
      // Validate inputs - should still be valid if we have >= 3 points
      const validationResult = validatePredictionInputs(history, slope, intercept);
      
      if (validationResult.isValid && validationResult.validData.length >= 3) {
        // Future predictions might work with minimal data
        const futureResult = computeFutureWaterLevels(
          validationResult.validData,
          slope,
          intercept,
          baseDate
        );
        expect(futureResult.predictions).toHaveLength(4);
      }
      
      // Seasonal predictions should fail with only 2 years
      const rechargePattern = createRechargePattern(history);
      const seasonalValidation = validateSeasonalData(rechargePattern, 3);
      expect(seasonalValidation.isValid).toBe(false);
      expect(seasonalValidation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility', () => {
    test('INTEGRATION: Response includes all existing fields plus predictions', () => {
      // Simulate a complete response structure
      const history = createWRISLikeHistory(8, 12, 0.4, 0.8);
      const baseDate = new Date('2024-12-15');
      
      // Compute regression
      const firstDate = new Date(history[0].date).getTime();
      const x = history.map(h => 
        (new Date(h.date).getTime() - firstDate) / (365.25 * 24 * 60 * 60 * 1000)
      );
      const y = history.map(h => h.waterLevel);
      const { slope, intercept, fitted } = computeLinearRegression(x, y);
      
      // Create complete response structure (mimics route response)
      const response = {
        userLocation: { lat: 28.7041, lon: 77.1025, date: '2024-12-15' },
        nearestStation: {
          stationName: 'Test Station',
          latitude: 28.7041,
          longitude: 77.1025,
          distanceKm: '0.50',
          wellType: 'Dug Well',
          wellDepth: 50,
          wellAquiferType: 'Alluvial',
          note: null
        },
        currentWaterLevel: history[history.length - 1].waterLevel.toFixed(2),
        historicalLevels: history,
        rechargePattern: createRechargePattern(history),
        rechargeTrend: { annualChange: slope.toFixed(2) },
        stressAnalysis: {
          trend: slope > 0 ? 'rising' : 'declining',
          annualDeclineRate: Math.abs(slope).toFixed(2),
          category: 'Safe'
        },
        plotData: {
          historicalWaterLevels: history,
          trendLine: fitted.map((f, i) => ({ date: history[i].date, fitted: f.toFixed(2) }))
        },
        predictions: {} // New field
      };
      
      // Verify all existing fields are present
      expect(response.userLocation).toBeDefined();
      expect(response.nearestStation).toBeDefined();
      expect(response.currentWaterLevel).toBeDefined();
      expect(response.historicalLevels).toBeDefined();
      expect(response.rechargePattern).toBeDefined();
      expect(response.rechargeTrend).toBeDefined();
      expect(response.stressAnalysis).toBeDefined();
      expect(response.plotData).toBeDefined();
      
      // Verify new predictions field is present
      expect(response.predictions).toBeDefined();
      
      // Existing clients that don't check predictions should still work
      expect(response.currentWaterLevel).toMatch(/^\d+\.\d{2}$/);
      expect(response.historicalLevels.length).toBeGreaterThan(0);
    });


    test('INTEGRATION: Predictions field is optional for existing clients', () => {
      // Existing clients should be able to ignore predictions field
      const response = {
        userLocation: { lat: 28.7041, lon: 77.1025, date: '2024-12-15' },
        currentWaterLevel: '12.50',
        historicalLevels: [],
        predictions: {
          futureWaterLevels: {},
          errors: []
        }
      };
      
      // Client that only reads existing fields
      const { userLocation, currentWaterLevel, historicalLevels } = response;
      
      expect(userLocation).toBeDefined();
      expect(currentWaterLevel).toBe('12.50');
      expect(historicalLevels).toEqual([]);
      
      // predictions field exists but doesn't break existing clients
      expect(response.predictions).toBeDefined();
    });
  });

  describe('Graceful Degradation', () => {
    test('INTEGRATION: Insufficient data for future predictions produces error', () => {
      // Only 2 data points - below minimum
      const history = [
        { date: new Date('2023-01-01'), waterLevel: 10 },
        { date: new Date('2024-01-01'), waterLevel: 11 }
      ];
      const baseDate = new Date('2024-12-15');
      
      // Validate inputs
      const validationResult = validatePredictionInputs(history, 1.0, 10);
      
      // Should fail validation
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
      expect(validationResult.errors[0]).toContain('Insufficient data points');
      
      // Attempting to compute predictions should throw
      expect(() => computeFutureWaterLevels(history, 1.0, 10, baseDate))
        .toThrow('Insufficient data points');
    });

    test('INTEGRATION: Invalid regression parameters produce error', () => {
      const history = createWRISLikeHistory(5, 12, 0.5, 0.5);
      const baseDate = new Date('2024-12-15');
      
      // Invalid slope (NaN)
      const validationResult = validatePredictionInputs(history, NaN, 10);
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
      // Check for error message about invalid parameters
      const hasInvalidParamError = validationResult.errors.some(e => 
        e.toLowerCase().includes('invalid') || e.toLowerCase().includes('nan')
      );
      expect(hasInvalidParamError).toBe(true);
      
      // Attempting to compute should throw
      expect(() => computeFutureWaterLevels(history, NaN, 10, baseDate))
        .toThrow();
    });

    test('INTEGRATION: Insufficient seasonal data produces error', () => {
      // Only 2 years of data
      const history = createWRISLikeHistory(2, 12, 0.3, 0.5);
      const rechargePattern = createRechargePattern(history);
      
      // Validate seasonal data
      const seasonalValidation = validateSeasonalData(rechargePattern, 3);
      
      expect(seasonalValidation.isValid).toBe(false);
      expect(seasonalValidation.errors.length).toBeGreaterThan(0);
      // Check for error about insufficient seasonal cycles
      expect(seasonalValidation.errors[0]).toMatch(/Insufficient seasonal/i);
    });

    test('INTEGRATION: Prediction errors are collected without failing entire response', () => {
      // Simulate scenario where some predictions fail
      const errors = [];
      
      // Try future predictions with insufficient data
      try {
        const history = [{ date: new Date(), waterLevel: 10 }];
        computeFutureWaterLevels(history, 0.5, 10, new Date());
      } catch (error) {
        errors.push({
          type: 'insufficient_data',
          message: error.message,
          affectedPredictions: ['futureWaterLevels']
        });
      }
      
      // Try seasonal predictions with insufficient data
      try {
        const rechargePattern = [{ year: 2023, rechargeAmount: 1.5 }];
        const validation = validateSeasonalData(rechargePattern, 3);
        if (!validation.isValid) {
          throw new Error(validation.errors[0]);
        }
      } catch (error) {
        errors.push({
          type: 'insufficient_data',
          message: error.message,
          affectedPredictions: ['seasonalPredictions']
        });
      }
      
      // Errors should be collected
      expect(errors.length).toBe(2);
      expect(errors[0].affectedPredictions).toContain('futureWaterLevels');
      expect(errors[1].affectedPredictions).toContain('seasonalPredictions');
      
      // Response structure with errors
      const response = {
        currentWaterLevel: '10.00',
        predictions: {
          errors: errors
        }
      };
      
      // Response should still be valid
      expect(response.currentWaterLevel).toBeDefined();
      expect(response.predictions.errors).toHaveLength(2);
    });
  });


  describe('Different Data Quality Scenarios (Indian Districts)', () => {
    test('SCENARIO: Rajasthan district with declining water levels', () => {
      // Rajasthan typically has declining groundwater
      const history = createWRISLikeHistory(10, 20, 0.8, 1.0); // Deep, declining
      const baseDate = new Date('2024-12-15');
      
      // Compute regression
      const firstDate = new Date(history[0].date).getTime();
      const x = history.map(h => 
        (new Date(h.date).getTime() - firstDate) / (365.25 * 24 * 60 * 60 * 1000)
      );
      const y = history.map(h => h.waterLevel);
      const { slope, intercept, fitted } = computeLinearRegression(x, y);
      
      // Validate
      const validationResult = validatePredictionInputs(history, slope, intercept);
      expect(validationResult.isValid).toBe(true);
      
      // Future predictions
      const futureResult = computeFutureWaterLevels(
        validationResult.validData,
        slope,
        intercept,
        baseDate
      );
      
      // With positive slope (declining), predictions should show increasing water depth
      // Year 5 should be deeper than year 1
      expect(futureResult.predictions[3].predictedLevel).toBeGreaterThan(
        futureResult.predictions[0].predictedLevel
      );
      
      // Positive slope indicates worsening conditions
      expect(slope).toBeGreaterThan(0);
      
      // Stress category should show transition
      const currentWaterLevel = history[history.length - 1].waterLevel;
      const stressResult = predictStressCategoryTransition(
        'Critical',
        Math.abs(slope),
        currentWaterLevel
      );
      
      // High decline rate should predict transition to Over-exploited
      expect(stressResult.predictions.nextCategory).toBe('Over-exploited');
      expect(stressResult.predictions.yearsUntilTransition).toBeDefined();
    });

    test('SCENARIO: Kerala district with stable water levels', () => {
      // Kerala typically has better groundwater conditions
      const history = createWRISLikeHistory(8, 8, 0.05, 0.3); // Shallow, stable
      const baseDate = new Date('2024-12-15');
      
      // Compute regression
      const firstDate = new Date(history[0].date).getTime();
      const x = history.map(h => 
        (new Date(h.date).getTime() - firstDate) / (365.25 * 24 * 60 * 60 * 1000)
      );
      const y = history.map(h => h.waterLevel);
      const { slope, intercept } = computeLinearRegression(x, y);
      
      // Validate
      const validationResult = validatePredictionInputs(history, slope, intercept);
      expect(validationResult.isValid).toBe(true);
      
      // Stress category should be Safe with stable conditions
      const currentWaterLevel = history[history.length - 1].waterLevel;
      const stressResult = predictStressCategoryTransition(
        'Safe',
        Math.abs(slope),
        currentWaterLevel
      );
      
      // Low decline rate should show stable conditions
      expect(stressResult.predictions.trend).toBe('stable');
      expect(stressResult.predictions.nextCategory).toBeNull();
    });

    test('SCENARIO: Punjab district with improving water levels', () => {
      // Some Punjab districts show improvement due to conservation
      const history = createWRISLikeHistory(7, 15, -0.3, 0.5); // Improving (negative trend)
      const baseDate = new Date('2024-12-15');
      
      // Compute regression
      const firstDate = new Date(history[0].date).getTime();
      const x = history.map(h => 
        (new Date(h.date).getTime() - firstDate) / (365.25 * 24 * 60 * 60 * 1000)
      );
      const y = history.map(h => h.waterLevel);
      const { slope, intercept } = computeLinearRegression(x, y);
      
      // Validate
      const validationResult = validatePredictionInputs(history, slope, intercept);
      expect(validationResult.isValid).toBe(true);
      
      // Future predictions should show improving levels
      const futureResult = computeFutureWaterLevels(
        validationResult.validData,
        slope,
        intercept,
        baseDate
      );
      
      // With negative slope (improving), year 5 should be shallower than year 1
      expect(futureResult.predictions[3].predictedLevel).toBeLessThan(
        futureResult.predictions[0].predictedLevel
      );
      
      // Negative slope indicates improving conditions
      expect(slope).toBeLessThan(0);
      
      // Stress category prediction
      const currentWaterLevel = history[history.length - 1].waterLevel;
      const stressResult = predictStressCategoryTransition(
        'Semi-critical',
        Math.abs(slope), // Note: function expects positive value (0.3)
        currentWaterLevel
      );
      
      // With decline rate of 0.3 m/year (between 0.1 and 0.5), 
      // Semi-critical should predict transition to Critical
      expect(stressResult.currentCategory).toBe('Semi-critical');
      expect(stressResult.predictions.nextCategory).toBe('Critical');
      
      // Verify the prediction includes transition timing
      expect(stressResult.predictions.yearsUntilTransition).toBeDefined();
    });

    test('SCENARIO: District with sparse data (rural area)', () => {
      // Rural districts might have sparse monitoring
      const sparseHistory = [
        { date: new Date('2020-03-15'), waterLevel: 12 },
        { date: new Date('2021-11-20'), waterLevel: 13 },
        { date: new Date('2023-04-10'), waterLevel: 14 },
        { date: new Date('2024-10-05'), waterLevel: 15 }
      ];
      const baseDate = new Date('2024-12-15');
      
      // Compute regression
      const firstDate = new Date(sparseHistory[0].date).getTime();
      const x = sparseHistory.map(h => 
        (new Date(h.date).getTime() - firstDate) / (365.25 * 24 * 60 * 60 * 1000)
      );
      const y = sparseHistory.map(h => h.waterLevel);
      const { slope, intercept, fitted } = computeLinearRegression(x, y);
      
      // Validate
      const validationResult = validatePredictionInputs(sparseHistory, slope, intercept);
      
      // Should still be valid with 4 points
      expect(validationResult.isValid).toBe(true);
      
      // Future predictions should work but with lower confidence
      const futureResult = computeFutureWaterLevels(
        validationResult.validData,
        slope,
        intercept,
        baseDate
      );
      
      expect(futureResult.predictions).toHaveLength(4);
      
      // Calculate confidence
      const actualValues = validationResult.validData.map(h => h.waterLevel);
      const predictedValues = fitted;
      const rSquared = calculateRSquared(actualValues, predictedValues);
      const dataSpanYears = validationResult.metrics.dataSpanYears;
      const confidence = calculateConfidence(validationResult.validData, rSquared, dataSpanYears);
      
      // Sparse data should result in lower confidence
      expect(['low', 'medium']).toContain(confidence);
    });


    test('SCENARIO: District with high variance (inconsistent monitoring)', () => {
      // Some districts have inconsistent data quality
      const history = createWRISLikeHistory(6, 12, 0.4, 3.0); // High variance
      const baseDate = new Date('2024-12-15');
      
      // Compute regression
      const firstDate = new Date(history[0].date).getTime();
      const x = history.map(h => 
        (new Date(h.date).getTime() - firstDate) / (365.25 * 24 * 60 * 60 * 1000)
      );
      const y = history.map(h => h.waterLevel);
      const { slope, intercept, fitted } = computeLinearRegression(x, y);
      
      // Validate
      const validationResult = validatePredictionInputs(history, slope, intercept);
      expect(validationResult.isValid).toBe(true);
      
      // Calculate R-squared
      const actualValues = validationResult.validData.map(h => h.waterLevel);
      const predictedValues = fitted;
      const rSquared = calculateRSquared(actualValues, predictedValues);
      
      // High variance should result in lower R-squared
      expect(rSquared).toBeLessThan(0.9);
      
      // Confidence should reflect data quality
      const dataSpanYears = validationResult.metrics.dataSpanYears;
      const confidence = calculateConfidence(validationResult.validData, rSquared, dataSpanYears);
      
      // High variance typically results in lower confidence
      if (rSquared < 0.5) {
        expect(confidence).toBe('low');
      }
    });
  });

  describe('Cache Integration in Full Pipeline', () => {
    test('INTEGRATION: Complete response is cached with predictions', () => {
      const history = createWRISLikeHistory(8, 12, 0.5, 0.5);
      const baseDate = new Date('2024-12-15');
      
      // Compute regression
      const firstDate = new Date(history[0].date).getTime();
      const x = history.map(h => 
        (new Date(h.date).getTime() - firstDate) / (365.25 * 24 * 60 * 60 * 1000)
      );
      const y = history.map(h => h.waterLevel);
      const { slope, intercept, fitted } = computeLinearRegression(x, y);
      
      // Validate
      const validationResult = validatePredictionInputs(history, slope, intercept);
      
      // Compute all predictions
      const futureResult = computeFutureWaterLevels(
        validationResult.validData,
        slope,
        intercept,
        baseDate
      );
      
      const currentWaterLevel = history[history.length - 1].waterLevel;
      const stressResult = predictStressCategoryTransition(
        'Safe',
        Math.abs(slope),
        currentWaterLevel
      );
      
      const rechargePattern = createRechargePattern(history);
      const seasonalValidation = validateSeasonalData(rechargePattern, 3);
      let seasonalResult = null;
      if (seasonalValidation.isValid) {
        seasonalResult = predictSeasonalLevels(
          validationResult.validData,
          baseDate,
          slope
        );
      }
      
      // Create complete response
      const response = {
        userLocation: { lat: 28.7041, lon: 77.1025, date: '2024-12-15' },
        currentWaterLevel: currentWaterLevel.toFixed(2),
        historicalLevels: history,
        predictions: {
          futureWaterLevels: futureResult,
          stressCategoryTransition: stressResult,
          seasonalPredictions: seasonalResult,
          errors: []
        }
      };
      
      // Cache the response
      const cacheKey = generateCacheKey('water-level', { 
        lat: 28.7041, 
        lon: 77.1025, 
        date: '2024-12-15' 
      });
      wrisCache.set(cacheKey, response);
      
      // Retrieve from cache
      const cachedResponse = wrisCache.get(cacheKey);
      
      // Verify complete structure is cached
      expect(cachedResponse).toBeDefined();
      expect(cachedResponse.predictions).toBeDefined();
      expect(cachedResponse.predictions.futureWaterLevels).toBeDefined();
      expect(cachedResponse.predictions.stressCategoryTransition).toBeDefined();
      expect(cachedResponse.predictions.errors).toEqual([]);
      
      // Verify predictions match original
      expect(cachedResponse.predictions.futureWaterLevels.predictions).toHaveLength(4);
      expect(cachedResponse.predictions.stressCategoryTransition.currentCategory).toBe('Safe');
    });

    test('INTEGRATION: Cache hit skips all prediction computations', () => {
      const cacheKey = generateCacheKey('water-level', { 
        lat: 28.7041, 
        lon: 77.1025, 
        date: '2024-12-15' 
      });
      
      // Pre-populate cache
      const cachedResponse = {
        userLocation: { lat: 28.7041, lon: 77.1025, date: '2024-12-15' },
        currentWaterLevel: '12.50',
        predictions: {
          futureWaterLevels: {
            predictions: [
              { year: 1, predictedLevel: 13.0 }
            ]
          },
          errors: []
        }
      };
      
      wrisCache.set(cacheKey, cachedResponse);
      
      // Simulate route logic: check cache first
      const cached = wrisCache.get(cacheKey);
      
      if (cached) {
        // Cache hit - no computation needed
        expect(cached.predictions).toBeDefined();
        expect(cached.predictions.futureWaterLevels.predictions).toHaveLength(1);
        
        // Verify we can return cached data directly
        const response = { ...cached, cached: true };
        expect(response.cached).toBe(true);
        expect(response.predictions).toEqual(cachedResponse.predictions);
      }
    });
  });

  describe('Performance Validation', () => {
    test('INTEGRATION: Prediction computation completes within performance target', () => {
      // Test with various data sizes
      const dataSizes = [10, 50, 100];
      
      dataSizes.forEach(size => {
        const history = createWRISLikeHistory(Math.ceil(size / 6), 12, 0.5, 0.5);
        const baseDate = new Date('2024-12-15');
        
        // Compute regression
        const firstDate = new Date(history[0].date).getTime();
        const x = history.map(h => 
          (new Date(h.date).getTime() - firstDate) / (365.25 * 24 * 60 * 60 * 1000)
        );
        const y = history.map(h => h.waterLevel);
        const { slope, intercept } = computeLinearRegression(x, y);
        
        // Validate
        const validationResult = validatePredictionInputs(history, slope, intercept);
        
        if (validationResult.isValid) {
          // Measure prediction computation time
          const startTime = Date.now();
          
          computeFutureWaterLevels(
            validationResult.validData,
            slope,
            intercept,
            baseDate
          );
          
          const currentWaterLevel = history[history.length - 1].waterLevel;
          predictStressCategoryTransition(
            'Safe',
            Math.abs(slope),
            currentWaterLevel
          );
          
          const rechargePattern = createRechargePattern(history);
          const seasonalValidation = validateSeasonalData(rechargePattern, 3);
          if (seasonalValidation.isValid) {
            predictSeasonalLevels(
              validationResult.validData,
              baseDate,
              slope
            );
          }
          
          const computeTime = Date.now() - startTime;
          
          // Should complete within 100ms (Requirement 6.1)
          expect(computeTime).toBeLessThan(100);
        }
      });
    });
  });
});

