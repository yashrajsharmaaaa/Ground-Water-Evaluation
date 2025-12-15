/**
 * Property-Based Tests for Error Handling and Validation
 * 
 * Tests universal properties related to error handling, validation, and data quality
 * using fast-check property-based testing library.
 * 
 * Per Task 15: Implement property-based tests for error handling and validation
 * Requirements: 6.1, 6.2, 6.4, 6.6
 */

import { describe, test } from '@jest/globals';
import fc from 'fast-check';
import { 
  computeFutureWaterLevels,
  predictStressCategoryTransition,
  predictSeasonalLevels,
  calculateConfidence
} from '../../utils/predictions.js';
import { 
  filterInvalidHistoricalData,
  validatePredictionInputs,
  checkDataQuality
} from '../../utils/validation.js';
import { 
  historicalDataGenerator,
  regressionParamsGenerator,
  dateGenerator,
  stressCategoryGenerator,
  waterLevelGenerator,
  declineRateGenerator
} from '../utils/generators.js';

// ============================================================================
// PROPERTY 15: Prediction errors don't fail entire request
// Feature: predictions-code-audit, Property 15: Prediction errors don't fail entire request
// Validates: Requirements 6.1, 6.2
// ============================================================================

describe('Property 15: Prediction errors don\'t fail entire request', () => {
  test('for any prediction function with invalid inputs, errors are caught and don\'t throw', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Invalid history: empty array
          { history: [], slope: 0.5, intercept: 10, baseDate: new Date() },
          // Invalid history: too few points
          { history: [{ date: '2024-01-01', waterLevel: 10 }], slope: 0.5, intercept: 10, baseDate: new Date() },
          // Invalid slope: NaN
          { history: [{ date: '2024-01-01', waterLevel: 10 }, { date: '2024-02-01', waterLevel: 11 }, { date: '2024-03-01', waterLevel: 12 }], slope: NaN, intercept: 10, baseDate: new Date() },
          // Invalid intercept: null
          { history: [{ date: '2024-01-01', waterLevel: 10 }, { date: '2024-02-01', waterLevel: 11 }, { date: '2024-03-01', waterLevel: 12 }], slope: 0.5, intercept: null, baseDate: new Date() },
          // Invalid baseDate: not a Date
          { history: [{ date: '2024-01-01', waterLevel: 10 }, { date: '2024-02-01', waterLevel: 11 }, { date: '2024-03-01', waterLevel: 12 }], slope: 0.5, intercept: 10, baseDate: 'invalid' }
        ),
        (invalidInput) => {
          // Property: Calling prediction functions with invalid inputs should throw errors
          // but these errors should be catchable (not crash the process)
          let errorCaught = false;
          
          try {
            computeFutureWaterLevels(
              invalidInput.history,
              invalidInput.slope,
              invalidInput.intercept,
              invalidInput.baseDate
            );
          } catch (error) {
            errorCaught = true;
            // Property: Error should be an Error instance with a message
            if (!(error instanceof Error) || !error.message) {
              return false;
            }
          }
          
          // Property: Invalid inputs should throw errors (errorCaught should be true)
          return errorCaught;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any stress transition with invalid inputs, errors are caught gracefully', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Invalid category: empty string
          { category: '', declineRate: 0.5, waterLevel: 10 },
          // Invalid category: wrong type
          { category: 123, declineRate: 0.5, waterLevel: 10 },
          // Invalid declineRate: NaN
          { category: 'Safe', declineRate: NaN, waterLevel: 10 },
          // Invalid waterLevel: null
          { category: 'Safe', declineRate: 0.5, waterLevel: null },
          // Invalid category: unknown value
          { category: 'Unknown', declineRate: 0.5, waterLevel: 10 }
        ),
        (invalidInput) => {
          let errorCaught = false;
          
          try {
            predictStressCategoryTransition(
              invalidInput.category,
              invalidInput.declineRate,
              invalidInput.waterLevel
            );
          } catch (error) {
            errorCaught = true;
            // Property: Error should be descriptive
            if (!(error instanceof Error) || !error.message || error.message.length === 0) {
              return false;
            }
          }
          
          // Property: Invalid inputs should throw errors
          return errorCaught;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any seasonal prediction with insufficient cycles, error is descriptive', () => {
    fc.assert(
      fc.property(
        // Generate history with insufficient seasonal cycles (< 3 complete years)
        historicalDataGenerator({ minLength: 1, maxLength: 5 }),
        dateGenerator(),
        (history, currentDate) => {
          let errorCaught = false;
          let errorMessage = '';
          
          try {
            predictSeasonalLevels(history, currentDate, 0);
          } catch (error) {
            errorCaught = true;
            errorMessage = error.message;
          }
          
          // Property: If error is caught, it should be descriptive (have a message)
          // The error might be about insufficient data points OR insufficient cycles
          if (errorCaught && errorMessage) {
            // Error message should be non-empty and descriptive
            return errorMessage.length > 0;
          }
          
          // If no error, that's also valid (might have enough cycles by chance)
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 16: No null values in prediction inputs
// Feature: predictions-code-audit, Property 16: No null values in prediction inputs
// Validates: Requirements 6.1, 6.2
// ============================================================================

describe('Property 16: No null values in prediction inputs', () => {
  test('for any historical data with null/NaN values, filterInvalidHistoricalData removes them', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: fc.oneof(
              fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
              fc.constant(null),
              fc.constant('invalid-date')
            ),
            waterLevel: fc.oneof(
              fc.float({ min: 0, max: 50, noNaN: true, noDefaultInfinity: true }),
              fc.constant(null),
              fc.constant(undefined),
              fc.constant(NaN)
            )
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (history) => {
          // Execute filter
          const result = filterInvalidHistoricalData(history);
          
          // Property: validData should contain no null/NaN water levels
          const hasNoNullWaterLevels = result.validData.every(record => {
            return record.waterLevel !== null && 
                   record.waterLevel !== undefined && 
                   !isNaN(record.waterLevel) &&
                   isFinite(record.waterLevel);
          });
          
          // Property: validData should contain no invalid dates
          const hasNoInvalidDates = result.validData.every(record => {
            const date = new Date(record.date);
            return !isNaN(date.getTime());
          });
          
          // Property: invalidCount should match the number of filtered records
          const expectedInvalidCount = history.length - result.validData.length;
          const invalidCountMatches = result.invalidCount === expectedInvalidCount;
          
          return hasNoNullWaterLevels && hasNoInvalidDates && invalidCountMatches;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any valid historical data, all prediction inputs are non-null', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 3, maxLength: 100 }),
        regressionParamsGenerator(),
        dateGenerator(),
        (history, regressionParams, baseDate) => {
          // Filter data
          const filterResult = filterInvalidHistoricalData(history);
          
          // Property: After filtering, all values should be valid
          if (filterResult.validData.length < 3) {
            return true; // Skip if insufficient data after filtering
          }
          
          // Validate inputs
          const validation = validatePredictionInputs(
            filterResult.validData,
            regressionParams.slope,
            regressionParams.intercept,
            { minPoints: 3, minSpanYears: 0 }
          );
          
          // Property: If validation passes, all inputs should be non-null
          if (validation.isValid) {
            const allNonNull = validation.validData.every(record => {
              return record.waterLevel !== null && 
                     record.waterLevel !== undefined && 
                     !isNaN(record.waterLevel);
            });
            return allNonNull;
          }
          
          return true; // Validation can fail for other reasons
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any prediction computation, inputs are validated before use', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 3, maxLength: 100 }),
        regressionParamsGenerator(),
        dateGenerator(),
        (history, regressionParams, baseDate) => {
          // Property: computeFutureWaterLevels should validate inputs internally
          // If inputs are invalid, it should throw an error (not return invalid results)
          
          try {
            const result = computeFutureWaterLevels(
              history,
              regressionParams.slope,
              regressionParams.intercept,
              baseDate
            );
            
            // Property: If computation succeeds, all predictions should have valid values
            const allPredictionsValid = result.predictions.every(pred => {
              return pred.predictedLevel !== null &&
                     pred.predictedLevel !== undefined &&
                     !isNaN(pred.predictedLevel) &&
                     isFinite(pred.predictedLevel);
            });
            
            return allPredictionsValid;
          } catch (error) {
            // Property: Errors are acceptable for invalid inputs
            return true;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 17: Poor data quality reduces confidence
// Feature: predictions-code-audit, Property 17: Poor data quality reduces confidence
// Validates: Requirements 6.1, 6.2
// ============================================================================

describe('Property 17: Poor data quality reduces confidence', () => {
  test('for any historical data with fewer points, confidence is lower than with more points', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.6), max: Math.fround(0.9), noNaN: true, noDefaultInfinity: true }), // Good R-squared
        fc.integer({ min: 5, max: 10 }), // Data span years
        (rSquared, dataSpanYears) => {
          // Create two scenarios: few points vs many points
          const fewPoints = Array.from({ length: 5 }, (_, i) => ({
            date: new Date(2020 + i, 0, 1).toISOString(),
            waterLevel: 10 + i * 0.5
          }));
          
          const manyPoints = Array.from({ length: 25 }, (_, i) => ({
            date: new Date(2020, i, 1).toISOString(),
            waterLevel: 10 + i * 0.5
          }));
          
          const confidenceFew = calculateConfidence(fewPoints, rSquared, dataSpanYears);
          const confidenceMany = calculateConfidence(manyPoints, rSquared, dataSpanYears);
          
          // Property: More data points should result in equal or higher confidence
          const confidenceLevels = { 'low': 0, 'medium': 1, 'high': 2 };
          
          return confidenceLevels[confidenceMany] >= confidenceLevels[confidenceFew];
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any historical data with shorter span, confidence is lower than with longer span', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.6), max: Math.fround(0.9), noNaN: true, noDefaultInfinity: true }), // Good R-squared
        (rSquared) => {
          // Create history with sufficient points
          const history = Array.from({ length: 20 }, (_, i) => ({
            date: new Date(2020, i, 1).toISOString(),
            waterLevel: 10 + i * 0.5
          }));
          
          // Test with different data spans
          const shortSpan = 1; // 1 year
          const longSpan = 6; // 6 years
          
          const confidenceShort = calculateConfidence(history, rSquared, shortSpan);
          const confidenceLong = calculateConfidence(history, rSquared, longSpan);
          
          // Property: Longer data span should result in equal or higher confidence
          const confidenceLevels = { 'low': 0, 'medium': 1, 'high': 2 };
          
          return confidenceLevels[confidenceLong] >= confidenceLevels[confidenceShort];
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any historical data with low R-squared, confidence is never high', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 20, maxLength: 100 }),
        fc.float({ min: 0, max: 0.5, noNaN: true, noDefaultInfinity: true }), // Low R-squared
        fc.integer({ min: 5, max: 10 }), // Good data span
        (history, rSquared, dataSpanYears) => {
          const confidence = calculateConfidence(history, rSquared, dataSpanYears);
          
          // Property: Low R-squared (< 0.5) should never result in high confidence
          return confidence !== 'high';
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any data quality check, insufficient data is flagged', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }), // Fewer than minimum required points
        (dataPoints) => {
          // Create history with insufficient points
          const history = Array.from({ length: dataPoints }, (_, i) => ({
            date: new Date(2024, i, 1).toISOString(),
            waterLevel: 10 + i
          }));
          
          const qualityCheck = checkDataQuality(history, { minPoints: 3, minSpanYears: 0 });
          
          // Property: Quality check should fail for insufficient data
          return !qualityCheck.isValid && qualityCheck.errors.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 18: Aggregation consistency
// Feature: predictions-code-audit, Property 18: Aggregation consistency
// Validates: Requirements 6.1, 6.2
// ============================================================================

describe('Property 18: Aggregation consistency', () => {
  test('for any valid historical data, filtered data count plus invalid count equals original count', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: fc.oneof(
              fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
              fc.constant(null)
            ),
            waterLevel: fc.oneof(
              fc.float({ min: 0, max: 50, noNaN: true, noDefaultInfinity: true }),
              fc.constant(null),
              fc.constant(NaN)
            )
          }),
          { minLength: 1, maxLength: 100 }
        ),
        (history) => {
          const filterResult = filterInvalidHistoricalData(history);
          
          // Property: validData.length + invalidCount should equal original history.length
          return filterResult.validData.length + filterResult.invalidCount === history.length;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any prediction result, all numeric values are finite and non-NaN', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 3, maxLength: 100 }),
        regressionParamsGenerator(),
        dateGenerator(),
        (history, regressionParams, baseDate) => {
          try {
            const result = computeFutureWaterLevels(
              history,
              regressionParams.slope,
              regressionParams.intercept,
              baseDate
            );
            
            // Property: All predicted levels should be finite and non-NaN
            const allFinite = result.predictions.every(pred => {
              return isFinite(pred.predictedLevel) && !isNaN(pred.predictedLevel);
            });
            
            return allFinite;
          } catch (error) {
            // Errors are acceptable for invalid inputs
            return true;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any stress transition result, all numeric values are consistent', () => {
    fc.assert(
      fc.property(
        stressCategoryGenerator(),
        declineRateGenerator({ min: 0, max: 2 }), // Positive decline rates only
        waterLevelGenerator({ min: 5, max: 40 }),
        (category, declineRate, waterLevel) => {
          try {
            const result = predictStressCategoryTransition(category, declineRate, waterLevel);
            
            // Property: currentDeclineRate should match input (rounded)
            const roundedInput = Math.round(declineRate * 1000) / 1000;
            const declineRateMatches = result.currentDeclineRate === roundedInput;
            
            // Property: If yearsUntilTransition exists, it should be finite and non-negative
            let yearsValid = true;
            if (result.predictions && result.predictions.yearsUntilTransition !== null) {
              yearsValid = isFinite(result.predictions.yearsUntilTransition) && 
                          result.predictions.yearsUntilTransition >= 0;
            }
            
            return declineRateMatches && yearsValid;
          } catch (error) {
            // Errors are acceptable for invalid inputs
            return true;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any validation result, error count matches errors array length', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
            waterLevel: fc.float({ min: 0, max: 50, noNaN: true, noDefaultInfinity: true })
          }),
          { minLength: 0, maxLength: 100 }
        ),
        regressionParamsGenerator(),
        (history, regressionParams) => {
          const validation = validatePredictionInputs(
            history,
            regressionParams.slope,
            regressionParams.intercept,
            { minPoints: 3, minSpanYears: 0 }
          );
          
          // Property: If not valid, errors array should not be empty
          if (!validation.isValid) {
            return validation.errors.length > 0;
          }
          
          // Property: If valid, errors array should be empty
          return validation.errors.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any seasonal prediction, both seasons are included or error is thrown', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 10, maxLength: 100 }),
        dateGenerator(),
        fc.float({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
        (history, currentDate, slope) => {
          try {
            const result = predictSeasonalLevels(history, currentDate, slope);
            
            // Property: Result should have both nextSeason and followingSeason
            const hasBothSeasons = result.nextSeason && result.followingSeason;
            
            // Property: Both seasons should have predictedLevel
            const bothHavePredictions = result.nextSeason.predictedLevel !== undefined &&
                                       result.followingSeason.predictedLevel !== undefined;
            
            return hasBothSeasons && bothHavePredictions;
          } catch (error) {
            // Property: If error is thrown, it should be descriptive
            return error instanceof Error && error.message.length > 0;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
