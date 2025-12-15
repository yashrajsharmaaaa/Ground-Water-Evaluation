/**
 * Test helper utilities for groundwater prediction tests
 * Provides common validation and assertion functions
 */

/**
 * Validate that a prediction response has the correct structure
 * @param {Object} predictions - Predictions object to validate
 * @returns {boolean} True if structure is valid
 */
export function validatePredictionStructure(predictions) {
  if (!predictions || typeof predictions !== 'object') {
    return false;
  }

  // Check for errors array
  if (!Array.isArray(predictions.errors)) {
    return false;
  }

  return true;
}

/**
 * Validate future water level predictions structure
 * @param {Object} futureWaterLevels - Future predictions object
 * @returns {boolean} True if structure is valid
 */
export function validateFuturePredictionsStructure(futureWaterLevels) {
  if (!futureWaterLevels || typeof futureWaterLevels !== 'object') {
    return false;
  }

  // Check required fields
  if (!futureWaterLevels.methodology || typeof futureWaterLevels.methodology !== 'string') {
    return false;
  }

  if (!futureWaterLevels.dataRange || typeof futureWaterLevels.dataRange !== 'object') {
    return false;
  }

  if (!futureWaterLevels.confidence || typeof futureWaterLevels.confidence !== 'string') {
    return false;
  }

  if (!Array.isArray(futureWaterLevels.predictions)) {
    return false;
  }

  // Validate each prediction
  for (const pred of futureWaterLevels.predictions) {
    if (!pred.year || !pred.date || pred.predictedLevel === undefined || !pred.unit) {
      return false;
    }
  }

  return true;
}

/**
 * Validate stress category transition structure
 * @param {Object} stressTransition - Stress transition object
 * @returns {boolean} True if structure is valid
 */
export function validateStressTransitionStructure(stressTransition) {
  if (!stressTransition || typeof stressTransition !== 'object') {
    return false;
  }

  // Check required fields
  if (!stressTransition.currentCategory || typeof stressTransition.currentCategory !== 'string') {
    return false;
  }

  if (stressTransition.currentDeclineRate === undefined) {
    return false;
  }

  if (!stressTransition.predictions || typeof stressTransition.predictions !== 'object') {
    return false;
  }

  if (!stressTransition.thresholds || typeof stressTransition.thresholds !== 'object') {
    return false;
  }

  if (!stressTransition.confidence || typeof stressTransition.confidence !== 'string') {
    return false;
  }

  return true;
}

/**
 * Validate seasonal predictions structure
 * @param {Object} seasonalPredictions - Seasonal predictions object
 * @returns {boolean} True if structure is valid
 */
export function validateSeasonalPredictionsStructure(seasonalPredictions) {
  if (!seasonalPredictions || typeof seasonalPredictions !== 'object') {
    return false;
  }

  // Check required fields
  if (!seasonalPredictions.methodology || typeof seasonalPredictions.methodology !== 'string') {
    return false;
  }

  if (!seasonalPredictions.currentSeason || typeof seasonalPredictions.currentSeason !== 'string') {
    return false;
  }

  if (!seasonalPredictions.nextSeason || typeof seasonalPredictions.nextSeason !== 'object') {
    return false;
  }

  if (!seasonalPredictions.followingSeason || typeof seasonalPredictions.followingSeason !== 'object') {
    return false;
  }

  if (!seasonalPredictions.confidence || typeof seasonalPredictions.confidence !== 'string') {
    return false;
  }

  // Validate season objects
  const validateSeason = (season) => {
    return season.season && season.period && 
           season.predictedLevel !== undefined && 
           season.historicalAverage !== undefined &&
           season.expectedRecharge !== undefined &&
           season.unit;
  };

  if (!validateSeason(seasonalPredictions.nextSeason) || 
      !validateSeason(seasonalPredictions.followingSeason)) {
    return false;
  }

  return true;
}

/**
 * Check if a value is within a reasonable range
 * @param {number} value - Value to check
 * @param {number} min - Minimum acceptable value
 * @param {number} max - Maximum acceptable value
 * @returns {boolean} True if value is in range
 */
export function isInRange(value, min, max) {
  return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
}

/**
 * Check if a date is valid
 * @param {Date|string} date - Date to validate
 * @returns {boolean} True if date is valid
 */
export function isValidDate(date) {
  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Calculate years between two dates
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} Years between dates
 */
export function yearsBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

/**
 * Check if confidence level is valid
 * @param {string} confidence - Confidence level to check
 * @returns {boolean} True if confidence is valid
 */
export function isValidConfidence(confidence) {
  return ['high', 'medium', 'low'].includes(confidence);
}

/**
 * Check if stress category is valid
 * @param {string} category - Category to check
 * @returns {boolean} True if category is valid
 */
export function isValidStressCategory(category) {
  return ['Safe', 'Semi-critical', 'Critical', 'Over-exploited'].includes(category);
}

/**
 * Check if season is valid
 * @param {string} season - Season to check
 * @returns {boolean} True if season is valid
 */
export function isValidSeason(season) {
  return ['pre-monsoon', 'post-monsoon'].includes(season);
}

/**
 * Filter out null/NaN values from historical data
 * @param {Array} history - Historical data array
 * @returns {Array} Filtered historical data
 */
export function filterValidData(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history.filter(item => {
    return item && 
           item.date && 
           isValidDate(item.date) &&
           typeof item.waterLevel === 'number' && 
           !isNaN(item.waterLevel) &&
           isFinite(item.waterLevel);
  });
}

/**
 * Calculate data span in years from historical data
 * @param {Array} history - Historical data array
 * @returns {number} Data span in years
 */
export function calculateDataSpan(history) {
  if (!Array.isArray(history) || history.length < 2) {
    return 0;
  }

  const dates = history.map(item => new Date(item.date)).sort((a, b) => a - b);
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  return yearsBetween(firstDate, lastDate);
}

/**
 * Determine current season from date
 * @param {Date} date - Date to check
 * @returns {string} 'pre-monsoon' or 'post-monsoon'
 */
export function getCurrentSeason(date) {
  const month = new Date(date).getMonth() + 1; // 1-12
  
  // Pre-monsoon: January (1) to May (5)
  if (month >= 1 && month <= 5) {
    return 'pre-monsoon';
  }
  
  // Post-monsoon: October (10) to December (12)
  if (month >= 10 && month <= 12) {
    return 'post-monsoon';
  }
  
  // Monsoon period (June-September) - default to pre-monsoon for next prediction
  return 'pre-monsoon';
}

/**
 * Get expected next season based on current season
 * @param {string} currentSeason - Current season
 * @returns {string} Next season
 */
export function getNextSeason(currentSeason) {
  return currentSeason === 'pre-monsoon' ? 'post-monsoon' : 'pre-monsoon';
}

/**
 * Create mock historical data for testing
 * @param {number} count - Number of data points
 * @param {number} startLevel - Starting water level
 * @param {number} slope - Annual decline rate
 * @returns {Array} Mock historical data
 */
export function createMockHistoricalData(count, startLevel = 10, slope = 0.5) {
  const data = [];
  const startDate = new Date('2020-01-01');
  
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + i * 3); // Quarterly data
    
    const waterLevel = startLevel + (slope * (i / 4)); // Convert quarters to years
    
    data.push({
      date: date.toISOString(),
      waterLevel: Math.max(0, waterLevel) // Ensure non-negative
    });
  }
  
  return data;
}

/**
 * Create mock recharge pattern for testing
 * @param {number} years - Number of years
 * @returns {Array} Mock recharge pattern
 */
export function createMockRechargePattern(years = 5) {
  const pattern = [];
  const startYear = 2020;
  
  for (let i = 0; i < years; i++) {
    const year = startYear + i;
    const preMonsoon = 12 + Math.random() * 3;
    const postMonsoon = 10 + Math.random() * 3;
    
    pattern.push({
      year,
      preMonsoonDepth: preMonsoon,
      postMonsoonDepth: postMonsoon,
      rechargeAmount: preMonsoon - postMonsoon
    });
  }
  
  return pattern;
}
