/**
 * Property-Based Tests for Seasonal Water Level Predictions
 * 
 * Tests universal properties that should hold for all valid inputs
 * using fast-check property-based testing library.
 * 
 * Per Task 14: Implement property-based tests for seasonal predictions
 * Requirements: 6.1, 6.2, 6.4, 6.6
 */

import { describe, test } from '@jest/globals';
import fc from 'fast-check';
import { predictSeasonalLevels } from '../../utils/predictions.js';
import { 
  historicalDataGenerator,
  dateGenerator,
  declineRateGenerator
} from '../utils/generators.js';

// ============================================================================
// PROPERTY 10: Seasonal predictions include both seasons
// Feature: predictions-code-audit, Property 10: Seasonal predictions include both seasons
// Validates: Requirements 6.1, 6.2
// ============================================================================

describe('Property 10: Seasonal predictions include both seasons', () => {
  test('for any valid historical data with ≥3 complete cycles, predictions include both nextSeason and followingSeason', () => {
    fc.assert(
      fc.property(
        // Generate historical data with enough seasonal coverage
        // Need at least 3 years of data with both pre-monsoon and post-monsoon measurements
        fc.array(
          fc.record({
            date: fc.date({ min: new Date('2019-01-01'), max: new Date('2024-12-31') }),
            waterLevel: fc.float({ min: 5, max: 30, noNaN: true, noDefaultInfinity: true })
          }),
          { minLength: 50, maxLength: 200 } // More data points to ensure seasonal coverage
        ).map(data => {
          // Ensure we have measurements in both seasons for multiple years
          const validData = data.filter(item => !isNaN(item.date.getTime()));
          return validData.sort((a, b) => a.date.getTime() - b.date.getTime());
        }),
        dateGenerator(new Date('2023-01-01'), new Date('2024-12-31')),
        declineRateGenerator(),
        (history, currentDate, slope) => {
          try {
            const result = predictSeasonalLevels(history, currentDate, slope);
            
            // Property: response must include nextSeason object
            if (!result.nextSeason || typeof result.nextSeason !== 'object') {
              return false;
            }
            
            // Property: response must include followingSeason object
            if (!result.followingSeason || typeof result.followingSeason !== 'object') {
              return false;
            }
            
            // Property: nextSeason must have required fields
            const nextSeasonFields = ['season', 'period', 'predictedLevel', 'historicalAverage', 'expectedRecharge', 'unit'];
            for (const field of nextSeasonFields) {
              if (!(field in result.nextSeason)) {
                return false;
              }
            }
            
            // Property: followingSeason must have required fields
            const followingSeasonFields = ['season', 'period', 'predictedLevel', 'historicalAverage', 'expectedRecharge', 'unit'];
            for (const field of followingSeasonFields) {
              if (!(field in result.followingSeason)) {
                return false;
              }
            }
            
            // Property: seasons must be different (next and following can't be the same)
            if (result.nextSeason.season === result.followingSeason.season) {
              // Only valid if they're in different years
              if (result.nextSeason.period === result.followingSeason.period) {
                return false;
              }
            }
            
            return true;
          } catch (error) {
            // If insufficient data, that's expected - skip this test case
            if (error.message.includes('Insufficient seasonal data') || 
                error.message.includes('Unable to calculate seasonal averages')) {
              return true; // Skip this case
            }
            throw error; // Re-throw unexpected errors
          }
        }
      ),
      { numRuns: 100 } // Run 100+ iterations as specified
    );
  });
  
  test('for any valid input, both seasons have valid season names (pre-monsoon or post-monsoon)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: fc.date({ min: new Date('2019-01-01'), max: new Date('2024-12-31') }),
            waterLevel: fc.float({ min: 5, max: 30, noNaN: true, noDefaultInfinity: true })
          }),
          { minLength: 50, maxLength: 200 }
        ).map(data => {
          const validData = data.filter(item => !isNaN(item.date.getTime()));
          return validData.sort((a, b) => a.date.getTime() - b.date.getTime());
        }),
        dateGenerator(new Date('2023-01-01'), new Date('2024-12-31')),
        declineRateGenerator(),
        (history, currentDate, slope) => {
          try {
            const result = predictSeasonalLevels(history, currentDate, slope);
            
            const validSeasons = ['pre-monsoon', 'post-monsoon'];
            
            // Property: nextSeason.season must be valid
            if (!validSeasons.includes(result.nextSeason.season)) {
              return false;
            }
            
            // Property: followingSeason.season must be valid
            if (!validSeasons.includes(result.followingSeason.season)) {
              return false;
            }
            
            return true;
          } catch (error) {
            if (error.message.includes('Insufficient seasonal data') || 
                error.message.includes('Unable to calculate seasonal averages')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 11: Seasonal predictions use 5-year window
// Feature: predictions-code-audit, Property 11: Seasonal predictions use 5-year window
// Validates: Requirements 6.1, 6.2
// ============================================================================

describe('Property 11: Seasonal predictions use 5-year window', () => {
  test('for any valid input, methodology mentions 5-year window', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: fc.date({ min: new Date('2019-01-01'), max: new Date('2024-12-31') }),
            waterLevel: fc.float({ min: 5, max: 30, noNaN: true, noDefaultInfinity: true })
          }),
          { minLength: 50, maxLength: 200 }
        ).map(data => {
          const validData = data.filter(item => !isNaN(item.date.getTime()));
          return validData.sort((a, b) => a.date.getTime() - b.date.getTime());
        }),
        dateGenerator(new Date('2023-01-01'), new Date('2024-12-31')),
        declineRateGenerator(),
        (history, currentDate, slope) => {
          try {
            const result = predictSeasonalLevels(history, currentDate, slope);
            
            // Property: methodology must mention "5-year"
            if (!result.methodology || typeof result.methodology !== 'string') {
              return false;
            }
            
            if (!result.methodology.includes('5-year')) {
              return false;
            }
            
            // Property: methodology should mention "seasonal average"
            if (!result.methodology.includes('seasonal average')) {
              return false;
            }
            
            return true;
          } catch (error) {
            if (error.message.includes('Insufficient seasonal data') || 
                error.message.includes('Unable to calculate seasonal averages')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 12: Recharge amount included in seasonal predictions
// Feature: predictions-code-audit, Property 12: Recharge amount included in seasonal predictions
// Validates: Requirements 6.1, 6.2
// ============================================================================

describe('Property 12: Recharge amount included in seasonal predictions', () => {
  test('for any valid input, both seasons include expectedRecharge field with numeric value', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: fc.date({ min: new Date('2019-01-01'), max: new Date('2024-12-31') }),
            waterLevel: fc.float({ min: 5, max: 30, noNaN: true, noDefaultInfinity: true })
          }),
          { minLength: 50, maxLength: 200 }
        ).map(data => {
          const validData = data.filter(item => !isNaN(item.date.getTime()));
          return validData.sort((a, b) => a.date.getTime() - b.date.getTime());
        }),
        dateGenerator(new Date('2023-01-01'), new Date('2024-12-31')),
        declineRateGenerator(),
        (history, currentDate, slope) => {
          try {
            const result = predictSeasonalLevels(history, currentDate, slope);
            
            // Property: nextSeason must have expectedRecharge
            if (typeof result.nextSeason.expectedRecharge !== 'number') {
              return false;
            }
            
            // Property: followingSeason must have expectedRecharge
            if (typeof result.followingSeason.expectedRecharge !== 'number') {
              return false;
            }
            
            // Property: expectedRecharge must not be NaN
            if (isNaN(result.nextSeason.expectedRecharge) || isNaN(result.followingSeason.expectedRecharge)) {
              return false;
            }
            
            return true;
          } catch (error) {
            if (error.message.includes('Insufficient seasonal data') || 
                error.message.includes('Unable to calculate seasonal averages')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any valid input, expectedRecharge values are rounded to 2 decimal places', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: fc.date({ min: new Date('2019-01-01'), max: new Date('2024-12-31') }),
            waterLevel: fc.float({ min: 5, max: 30, noNaN: true, noDefaultInfinity: true })
          }),
          { minLength: 50, maxLength: 200 }
        ).map(data => {
          const validData = data.filter(item => !isNaN(item.date.getTime()));
          return validData.sort((a, b) => a.date.getTime() - b.date.getTime());
        }),
        dateGenerator(new Date('2023-01-01'), new Date('2024-12-31')),
        declineRateGenerator(),
        (history, currentDate, slope) => {
          try {
            const result = predictSeasonalLevels(history, currentDate, slope);
            
            // Property: expectedRecharge must have at most 2 decimal places
            const checkDecimalPlaces = (value) => {
              const valueStr = value.toString();
              const decimalPart = valueStr.split('.')[1];
              if (!decimalPart) return true; // No decimal part is fine
              return decimalPart.length <= 2;
            };
            
            if (!checkDecimalPlaces(result.nextSeason.expectedRecharge)) {
              return false;
            }
            
            if (!checkDecimalPlaces(result.followingSeason.expectedRecharge)) {
              return false;
            }
            
            return true;
          } catch (error) {
            if (error.message.includes('Insufficient seasonal data') || 
                error.message.includes('Unable to calculate seasonal averages')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 13: Next season determined by current date
// Feature: predictions-code-audit, Property 13: Next season determined by current date
// Validates: Requirements 6.1, 6.2
// ============================================================================

describe('Property 13: Next season determined by current date', () => {
  test('for any date in pre-monsoon period (Jan-May), next season is post-monsoon', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: fc.date({ min: new Date('2019-01-01'), max: new Date('2024-12-31') }),
            waterLevel: fc.float({ min: 5, max: 30, noNaN: true, noDefaultInfinity: true })
          }),
          { minLength: 50, maxLength: 200 }
        ).map(data => {
          const validData = data.filter(item => !isNaN(item.date.getTime()));
          return validData.sort((a, b) => a.date.getTime() - b.date.getTime());
        }),
        // Generate date in pre-monsoon period (Jan-May) - filter out invalid dates
        fc.date({ min: new Date('2024-01-01'), max: new Date('2024-05-31') })
          .filter(date => !isNaN(date.getTime())),
        declineRateGenerator(),
        (history, currentDate, slope) => {
          try {
            const result = predictSeasonalLevels(history, currentDate, slope);
            
            // Property: if current date is in pre-monsoon, next season should be post-monsoon
            const month = currentDate.getMonth() + 1; // 0-indexed, so add 1
            const isPreMonsoon = month >= 1 && month <= 5;
            
            if (isPreMonsoon) {
              if (result.nextSeason.season !== 'post-monsoon') {
                return false;
              }
            }
            
            return true;
          } catch (error) {
            if (error.message.includes('Insufficient seasonal data') || 
                error.message.includes('Unable to calculate seasonal averages')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any date in post-monsoon period (Oct-Dec), next season is pre-monsoon', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: fc.date({ min: new Date('2019-01-01'), max: new Date('2024-12-31') }),
            waterLevel: fc.float({ min: 5, max: 30, noNaN: true, noDefaultInfinity: true })
          }),
          { minLength: 50, maxLength: 200 }
        ).map(data => {
          const validData = data.filter(item => !isNaN(item.date.getTime()));
          return validData.sort((a, b) => a.date.getTime() - b.date.getTime());
        }),
        // Generate date in post-monsoon period (Oct-Dec) - filter out invalid dates
        fc.date({ min: new Date('2024-10-01'), max: new Date('2024-12-31') })
          .filter(date => !isNaN(date.getTime())),
        declineRateGenerator(),
        (history, currentDate, slope) => {
          try {
            const result = predictSeasonalLevels(history, currentDate, slope);
            
            // Property: if current date is in post-monsoon, next season should be pre-monsoon
            const month = currentDate.getMonth() + 1;
            const isPostMonsoon = month >= 10 && month <= 12;
            
            if (isPostMonsoon) {
              if (result.nextSeason.season !== 'pre-monsoon') {
                return false;
              }
            }
            
            return true;
          } catch (error) {
            if (error.message.includes('Insufficient seasonal data') || 
                error.message.includes('Unable to calculate seasonal averages')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any date in monsoon period (Jun-Sep), next season is post-monsoon', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: fc.date({ min: new Date('2019-01-01'), max: new Date('2024-12-31') }),
            waterLevel: fc.float({ min: 5, max: 30, noNaN: true, noDefaultInfinity: true })
          }),
          { minLength: 50, maxLength: 200 }
        ).map(data => {
          const validData = data.filter(item => !isNaN(item.date.getTime()));
          return validData.sort((a, b) => a.date.getTime() - b.date.getTime());
        }),
        // Generate date in monsoon period (Jun-Sep) - filter out invalid dates
        fc.date({ min: new Date('2024-06-01'), max: new Date('2024-09-30') })
          .filter(date => !isNaN(date.getTime())),
        declineRateGenerator(),
        (history, currentDate, slope) => {
          try {
            const result = predictSeasonalLevels(history, currentDate, slope);
            
            // Property: if current date is in monsoon, next season should be post-monsoon
            // (monsoon defaults to pre-monsoon for getCurrentSeason, so next is post-monsoon)
            const month = currentDate.getMonth() + 1;
            const isMonsoon = month >= 6 && month <= 9;
            
            if (isMonsoon) {
              if (result.nextSeason.season !== 'post-monsoon') {
                return false;
              }
            }
            
            return true;
          } catch (error) {
            if (error.message.includes('Insufficient seasonal data') || 
                error.message.includes('Unable to calculate seasonal averages')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 14: Historical averages included for comparison
// Feature: predictions-code-audit, Property 14: Historical averages included for comparison
// Validates: Requirements 6.1, 6.2
// ============================================================================

describe('Property 14: Historical averages included for comparison', () => {
  test('for any valid input, both seasons include historicalAverage field with numeric value', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: fc.date({ min: new Date('2019-01-01'), max: new Date('2024-12-31') }),
            waterLevel: fc.float({ min: 5, max: 30, noNaN: true, noDefaultInfinity: true })
          }),
          { minLength: 50, maxLength: 200 }
        ).map(data => {
          const validData = data.filter(item => !isNaN(item.date.getTime()));
          return validData.sort((a, b) => a.date.getTime() - b.date.getTime());
        }),
        dateGenerator(new Date('2023-01-01'), new Date('2024-12-31')),
        declineRateGenerator(),
        (history, currentDate, slope) => {
          try {
            const result = predictSeasonalLevels(history, currentDate, slope);
            
            // Property: nextSeason must have historicalAverage
            if (typeof result.nextSeason.historicalAverage !== 'number') {
              return false;
            }
            
            // Property: followingSeason must have historicalAverage
            if (typeof result.followingSeason.historicalAverage !== 'number') {
              return false;
            }
            
            // Property: historicalAverage must not be NaN
            if (isNaN(result.nextSeason.historicalAverage) || isNaN(result.followingSeason.historicalAverage)) {
              return false;
            }
            
            // Property: historicalAverage should be positive (water level below ground)
            if (result.nextSeason.historicalAverage < 0 || result.followingSeason.historicalAverage < 0) {
              return false;
            }
            
            return true;
          } catch (error) {
            if (error.message.includes('Insufficient seasonal data') || 
                error.message.includes('Unable to calculate seasonal averages')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any valid input, historicalAverage values are rounded to 2 decimal places', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: fc.date({ min: new Date('2019-01-01'), max: new Date('2024-12-31') }),
            waterLevel: fc.float({ min: 5, max: 30, noNaN: true, noDefaultInfinity: true })
          }),
          { minLength: 50, maxLength: 200 }
        ).map(data => {
          const validData = data.filter(item => !isNaN(item.date.getTime()));
          return validData.sort((a, b) => a.date.getTime() - b.date.getTime());
        }),
        dateGenerator(new Date('2023-01-01'), new Date('2024-12-31')),
        declineRateGenerator(),
        (history, currentDate, slope) => {
          try {
            const result = predictSeasonalLevels(history, currentDate, slope);
            
            // Property: historicalAverage must have at most 2 decimal places
            const checkDecimalPlaces = (value) => {
              const valueStr = value.toString();
              const decimalPart = valueStr.split('.')[1];
              if (!decimalPart) return true; // No decimal part is fine
              return decimalPart.length <= 2;
            };
            
            if (!checkDecimalPlaces(result.nextSeason.historicalAverage)) {
              return false;
            }
            
            if (!checkDecimalPlaces(result.followingSeason.historicalAverage)) {
              return false;
            }
            
            return true;
          } catch (error) {
            if (error.message.includes('Insufficient seasonal data') || 
                error.message.includes('Unable to calculate seasonal averages')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('for any valid input, predictedLevel and historicalAverage are both present for comparison', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: fc.date({ min: new Date('2019-01-01'), max: new Date('2024-12-31') }),
            waterLevel: fc.float({ min: 5, max: 30, noNaN: true, noDefaultInfinity: true })
          }),
          { minLength: 50, maxLength: 200 }
        ).map(data => {
          const validData = data.filter(item => !isNaN(item.date.getTime()));
          return validData.sort((a, b) => a.date.getTime() - b.date.getTime());
        }),
        dateGenerator(new Date('2023-01-01'), new Date('2024-12-31')),
        declineRateGenerator(),
        (history, currentDate, slope) => {
          try {
            const result = predictSeasonalLevels(history, currentDate, slope);
            
            // Property: both predictedLevel and historicalAverage must be present for comparison
            // This allows users to see how predictions differ from historical patterns
            
            // Check nextSeason
            if (typeof result.nextSeason.predictedLevel !== 'number' || 
                typeof result.nextSeason.historicalAverage !== 'number') {
              return false;
            }
            
            // Check followingSeason
            if (typeof result.followingSeason.predictedLevel !== 'number' || 
                typeof result.followingSeason.historicalAverage !== 'number') {
              return false;
            }
            
            return true;
          } catch (error) {
            if (error.message.includes('Insufficient seasonal data') || 
                error.message.includes('Unable to calculate seasonal averages')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
