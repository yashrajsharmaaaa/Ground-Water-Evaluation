/**
 * Test data generators for property-based testing
 * Smart generators that produce realistic groundwater data
 */

import fc from 'fast-check';

/**
 * Generator for valid historical water level data
 * Produces sorted array of water level measurements with dates
 * @param {Object} options - Configuration options
 * @param {number} options.minLength - Minimum number of data points (default: 3)
 * @param {number} options.maxLength - Maximum number of data points (default: 500)
 * @param {Date} options.startDate - Start date for data range
 * @param {Date} options.endDate - End date for data range
 * @returns {fc.Arbitrary} Fast-check arbitrary for historical data
 */
export const historicalDataGenerator = (options = {}) => {
  const {
    minLength = 3,
    maxLength = 500,
    startDate = new Date('2014-01-01'),
    endDate = new Date('2024-12-31')
  } = options;

  return fc.array(
    fc.record({
      date: fc.date({ min: startDate, max: endDate }),
      waterLevel: fc.float({ min: 0, max: 50, noNaN: true, noDefaultInfinity: true })
    }),
    { minLength, maxLength }
  ).map(data => {
    // Filter out invalid dates and sort by date to ensure chronological order
    const validData = data.filter(item => !isNaN(item.date.getTime()));
    return validData.sort((a, b) => a.date.getTime() - b.date.getTime());
  }).filter(data => data.length >= minLength); // Ensure we still have minimum length after filtering
};

/**
 * Generator for recharge patterns (seasonal data)
 * Produces array of yearly recharge measurements
 * @param {Object} options - Configuration options
 * @param {number} options.minYears - Minimum number of years (default: 3)
 * @param {number} options.maxYears - Maximum number of years (default: 10)
 * @returns {fc.Arbitrary} Fast-check arbitrary for recharge patterns
 */
export const rechargePatternGenerator = (options = {}) => {
  const {
    minYears = 3,
    maxYears = 10
  } = options;

  return fc.array(
    fc.record({
      year: fc.integer({ min: 2015, max: 2024 }),
      preMonsoonDepth: fc.float({ min: 5, max: 30, noNaN: true, noDefaultInfinity: true }),
      postMonsoonDepth: fc.float({ min: 5, max: 30, noNaN: true, noDefaultInfinity: true }),
      rechargeAmount: fc.float({ min: -5, max: 5, noNaN: true, noDefaultInfinity: true })
    }),
    { minLength: minYears, maxLength: maxYears }
  ).map(data => {
    // Ensure rechargeAmount is consistent with depth difference
    return data.map(item => ({
      ...item,
      rechargeAmount: item.preMonsoonDepth - item.postMonsoonDepth
    }));
  });
};

/**
 * Generator for stress categories
 * @returns {fc.Arbitrary} Fast-check arbitrary for stress categories
 */
export const stressCategoryGenerator = () => {
  return fc.constantFrom('Safe', 'Semi-critical', 'Critical', 'Over-exploited');
};

/**
 * Generator for annual decline rates
 * Produces realistic decline rates in meters per year
 * @param {Object} options - Configuration options
 * @param {number} options.min - Minimum decline rate (default: -2, negative means improving)
 * @param {number} options.max - Maximum decline rate (default: 3)
 * @returns {fc.Arbitrary} Fast-check arbitrary for decline rates
 */
export const declineRateGenerator = (options = {}) => {
  const { min = -2, max = 3 } = options;
  return fc.float({ min, max, noNaN: true, noDefaultInfinity: true });
};

/**
 * Generator for regression parameters (slope and intercept)
 * @returns {fc.Arbitrary} Fast-check arbitrary for regression parameters
 */
export const regressionParamsGenerator = () => {
  return fc.record({
    slope: fc.float({ min: -2, max: 2, noNaN: true, noDefaultInfinity: true }),
    intercept: fc.float({ min: 0, max: 50, noNaN: true, noDefaultInfinity: true })
  });
};

/**
 * Generator for R-squared values (coefficient of determination)
 * @returns {fc.Arbitrary} Fast-check arbitrary for R-squared values (0-1)
 */
export const rSquaredGenerator = () => {
  return fc.float({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });
};

/**
 * Generator for dates within a specific range
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range
 * @returns {fc.Arbitrary} Fast-check arbitrary for dates
 */
export const dateGenerator = (startDate = new Date('2020-01-01'), endDate = new Date('2025-12-31')) => {
  return fc.date({ min: startDate, max: endDate }).filter(date => !isNaN(date.getTime()));
};

/**
 * Generator for pre-monsoon dates (January to May)
 * @param {number} year - Year for the date (default: 2024)
 * @returns {fc.Arbitrary} Fast-check arbitrary for pre-monsoon dates
 */
export const preMonsoonDateGenerator = (year = 2024) => {
  return fc.date({
    min: new Date(year, 0, 1),  // January 1
    max: new Date(year, 4, 31)  // May 31
  }).filter(date => !isNaN(date.getTime())); // Filter out invalid dates
};

/**
 * Generator for post-monsoon dates (October to December)
 * @param {number} year - Year for the date (default: 2024)
 * @returns {fc.Arbitrary} Fast-check arbitrary for post-monsoon dates
 */
export const postMonsoonDateGenerator = (year = 2024) => {
  return fc.date({
    min: new Date(year, 9, 1),   // October 1
    max: new Date(year, 11, 31)  // December 31
  }).filter(date => !isNaN(date.getTime())); // Filter out invalid dates
};

/**
 * Generator for water level values
 * @param {Object} options - Configuration options
 * @param {number} options.min - Minimum water level (default: 0)
 * @param {number} options.max - Maximum water level (default: 50)
 * @returns {fc.Arbitrary} Fast-check arbitrary for water levels
 */
export const waterLevelGenerator = (options = {}) => {
  const { min = 0, max = 50 } = options;
  return fc.float({ min, max, noNaN: true, noDefaultInfinity: true });
};

/**
 * Generator for data span in years
 * @param {Object} options - Configuration options
 * @param {number} options.min - Minimum years (default: 1)
 * @param {number} options.max - Maximum years (default: 15)
 * @returns {fc.Arbitrary} Fast-check arbitrary for data span
 */
export const dataSpanYearsGenerator = (options = {}) => {
  const { min = 1, max = 15 } = options;
  return fc.integer({ min, max });
};

/**
 * Generator for confidence levels
 * @returns {fc.Arbitrary} Fast-check arbitrary for confidence levels
 */
export const confidenceLevelGenerator = () => {
  return fc.constantFrom('high', 'medium', 'low');
};

/**
 * Generator for prediction horizons (years into future)
 * @returns {fc.Arbitrary} Fast-check arbitrary for prediction horizons
 */
export const predictionHorizonGenerator = () => {
  return fc.constantFrom(1, 2, 3, 5);
};

/**
 * Generator for complete prediction input data
 * Combines all necessary data for prediction computation
 * @returns {fc.Arbitrary} Fast-check arbitrary for complete prediction inputs
 */
export const predictionInputGenerator = () => {
  return fc.record({
    history: historicalDataGenerator({ minLength: 3, maxLength: 100 }),
    slope: fc.float({ min: -2, max: 2, noNaN: true, noDefaultInfinity: true }),
    intercept: fc.float({ min: 0, max: 50, noNaN: true, noDefaultInfinity: true }),
    baseDate: dateGenerator(),
    rechargePattern: rechargePatternGenerator({ minYears: 3, maxYears: 10 }),
    currentCategory: stressCategoryGenerator(),
    annualDeclineRate: declineRateGenerator()
  });
};
