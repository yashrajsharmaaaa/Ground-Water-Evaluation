/**
 * Property-Based Tests for Future Water Level Predictions
 * 
 * Tests universal properties that should hold for all valid inputs
 * using fast-check property-based testing library.
 * 
 * Per Task 12: Implement property-based tests for future predictions
 * Requirements: 6.1, 6.2, 6.4, 6.6
 */

import { describe, test } from '@jest/globals';
import fc from 'fast-check';
import { computeFutureWaterLevels } from '../../utils/predictions.js';
import { 
  historicalDataGenerator,
  regressionParamsGenerator,
  dateGenerator
} from '../utils/generators.js';

// ============================================================================
// PROPERTY 1: Future predictions contain required horizons
// Feature: predictions-code-audit, Property 1: Future predictions contain required horizons
// Validates: Requirements 6.1, 6.2
// ============================================================================

describe('Property 1: Future predictions contain required horizons', () => {
  test('for any valid historical data (≥3 points), predictions contain exactly years 1, 2, 3, and 5', () => {
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
          
          // Property: predictions array must contain exactly 4 elements
          if (result.predictions.length !== 4) {
            return false;
          }
          
          // Property: predictions must be for years 1, 2, 3, and 5
          const years = result.predictions.map(p => p.year);
          const expectedYears = [1, 2, 3, 5];
          
          // Check that years match exactly
          if (years.length !== expectedYears.length) {
            return false;
          }
          
          for (let i = 0; i < expectedYears.length; i++) {
            if (years[i] !== expectedYears[i]) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 } // Run 100+ iterations as specified
    );
  });
  
  test('for any valid input, each prediction has required fields: year, date, predictedLevel, unit', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 3, maxLength: 100 }),
        regressionParamsGenerator(),
        dateGenerator(),
        (history, regressionParams, baseDate) => {
          const result = computeFutureWaterLevels(
            history,
            regressionParams.slope,
            regressionParams.intercept,
            baseDate
          );
          
          // Property: every prediction must have all required fields
          return result.predictions.every(prediction => {
            return (
              typeof prediction.year === 'number' &&
              typeof prediction.date === 'string' &&
              typeof prediction.predictedLevel === 'number' &&
              prediction.unit === 'meters below ground level'
            );
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 2: Predictions match linear regression formula
// Feature: predictions-code-audit, Property 2: Predictions match linear regression formula
// Validates: Requirements 6.1, 6.2
// ============================================================================

describe('Property 2: Predictions match linear regression formula', () => {
  test('for any historical data and regression params, predicted levels equal intercept + slope * years', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 3, maxLength: 100 }),
        regressionParamsGenerator(),
        dateGenerator(),
        (history, regressionParams, baseDate) => {
          const { slope, intercept } = regressionParams;
          
          const result = computeFutureWaterLevels(
            history,
            slope,
            intercept,
            baseDate
          );
          
          // Property: each prediction must match the linear regression formula
          // predictedLevel = intercept + slope * years
          return result.predictions.every(prediction => {
            const expectedLevel = intercept + (slope * prediction.year);
            
            // Round expected level to 2 decimal places (same as implementation)
            const roundedExpected = Math.round(expectedLevel * 100) / 100;
            
            // Check if predicted level matches formula (within floating point tolerance)
            const difference = Math.abs(prediction.predictedLevel - roundedExpected);
            return difference < 0.01; // Allow small floating point error
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any input, predicted levels are rounded to exactly 2 decimal places', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 3, maxLength: 100 }),
        regressionParamsGenerator(),
        dateGenerator(),
        (history, regressionParams, baseDate) => {
          const result = computeFutureWaterLevels(
            history,
            regressionParams.slope,
            regressionParams.intercept,
            baseDate
          );
          
          // Property: all predicted levels must have at most 2 decimal places
          return result.predictions.every(prediction => {
            const levelStr = prediction.predictedLevel.toString();
            const decimalPart = levelStr.split('.')[1];
            
            // If no decimal part, that's fine (e.g., 10)
            if (!decimalPart) {
              return true;
            }
            
            // Check decimal places <= 2
            return decimalPart.length <= 2;
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any input with positive slope, predicted levels increase over time', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 3, maxLength: 100 }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(2), noNaN: true, noDefaultInfinity: true }), // Positive slope only
        fc.float({ min: Math.fround(0), max: Math.fround(50), noNaN: true, noDefaultInfinity: true }), // Intercept
        dateGenerator(),
        (history, slope, intercept, baseDate) => {
          const result = computeFutureWaterLevels(
            history,
            slope,
            intercept,
            baseDate
          );
          
          // Property: with positive slope, each prediction should be >= previous
          for (let i = 1; i < result.predictions.length; i++) {
            if (result.predictions[i].predictedLevel < result.predictions[i - 1].predictedLevel) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any input with negative slope, predicted levels decrease over time', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 3, maxLength: 100 }),
        fc.float({ min: Math.fround(-2), max: Math.fround(-0.01), noNaN: true, noDefaultInfinity: true }), // Negative slope only
        fc.float({ min: Math.fround(0), max: Math.fround(50), noNaN: true, noDefaultInfinity: true }), // Intercept
        dateGenerator(),
        (history, slope, intercept, baseDate) => {
          const result = computeFutureWaterLevels(
            history,
            slope,
            intercept,
            baseDate
          );
          
          // Property: with negative slope, each prediction should be <= previous
          for (let i = 1; i < result.predictions.length; i++) {
            if (result.predictions[i].predictedLevel > result.predictions[i - 1].predictedLevel) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 3: Predictions include confidence metadata
// Feature: predictions-code-audit, Property 3: Predictions include confidence metadata
// Validates: Requirements 6.1, 6.2
// ============================================================================

describe('Property 3: Predictions include confidence metadata', () => {
  test('for any valid input, response includes methodology field with description', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 3, maxLength: 100 }),
        regressionParamsGenerator(),
        dateGenerator(),
        (history, regressionParams, baseDate) => {
          const result = computeFutureWaterLevels(
            history,
            regressionParams.slope,
            regressionParams.intercept,
            baseDate
          );
          
          // Property: methodology must be present and be a non-empty string
          if (typeof result.methodology !== 'string' || result.methodology.length === 0) {
            return false;
          }
          
          // Property: methodology should mention "Linear regression"
          if (!result.methodology.includes('Linear regression')) {
            return false;
          }
          
          // Property: methodology should mention the data point count
          const dataPointCount = history.length;
          if (!result.methodology.includes(`${dataPointCount}-point`)) {
            return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any valid input, response includes dataRange with start and end dates', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 3, maxLength: 100 }),
        regressionParamsGenerator(),
        dateGenerator(),
        (history, regressionParams, baseDate) => {
          const result = computeFutureWaterLevels(
            history,
            regressionParams.slope,
            regressionParams.intercept,
            baseDate
          );
          
          // Property: dataRange must be present with start and end
          if (!result.dataRange || typeof result.dataRange !== 'object') {
            return false;
          }
          
          if (typeof result.dataRange.start !== 'string' || result.dataRange.start.length === 0) {
            return false;
          }
          
          if (typeof result.dataRange.end !== 'string' || result.dataRange.end.length === 0) {
            return false;
          }
          
          // Property: start date should be <= end date
          const startDate = new Date(result.dataRange.start);
          const endDate = new Date(result.dataRange.end);
          
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return false;
          }
          
          return startDate.getTime() <= endDate.getTime();
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any valid input, prediction dates are in the future relative to baseDate', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 3, maxLength: 100 }),
        regressionParamsGenerator(),
        dateGenerator(),
        (history, regressionParams, baseDate) => {
          const result = computeFutureWaterLevels(
            history,
            regressionParams.slope,
            regressionParams.intercept,
            baseDate
          );
          
          // Property: all prediction dates must be after baseDate
          return result.predictions.every(prediction => {
            const predictionDate = new Date(prediction.date);
            return predictionDate.getTime() > baseDate.getTime();
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any valid input, prediction dates are N years from baseDate (within 1 day tolerance)', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 3, maxLength: 100 }),
        regressionParamsGenerator(),
        dateGenerator(),
        (history, regressionParams, baseDate) => {
          const result = computeFutureWaterLevels(
            history,
            regressionParams.slope,
            regressionParams.intercept,
            baseDate
          );
          
          // Property: prediction dates should be approximately N years from baseDate
          // Allow 1-day tolerance for timezone/DST edge cases
          return result.predictions.every(prediction => {
            const predictionDate = new Date(prediction.date + 'T00:00:00Z'); // Parse as UTC
            
            // Calculate expected date
            const expectedDate = new Date(baseDate);
            expectedDate.setFullYear(expectedDate.getFullYear() + prediction.year);
            
            // Calculate difference in days
            const diffMs = Math.abs(predictionDate.getTime() - expectedDate.getTime());
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            
            // Allow up to 1 day difference for timezone/DST issues
            return diffDays <= 1;
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any valid input, all predictions have the same unit', () => {
    fc.assert(
      fc.property(
        historicalDataGenerator({ minLength: 3, maxLength: 100 }),
        regressionParamsGenerator(),
        dateGenerator(),
        (history, regressionParams, baseDate) => {
          const result = computeFutureWaterLevels(
            history,
            regressionParams.slope,
            regressionParams.intercept,
            baseDate
          );
          
          // Property: all predictions must have the same unit
          const expectedUnit = 'meters below ground level';
          return result.predictions.every(prediction => {
            return prediction.unit === expectedUnit;
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
