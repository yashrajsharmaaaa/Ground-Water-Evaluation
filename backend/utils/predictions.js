import { 
  filterInvalidHistoricalData, 
  validateRegressionParameters,
  checkDataQuality,
  validateDate,
  validateNumericParameter,
  isNullOrNaN
} from './validation.js';

const PRECISION = {
  WATER_LEVEL_DECIMALS: 2,
  DECLINE_RATE_DECIMALS: 3,
  WATER_LEVEL_MULTIPLIER: 100,
  DECLINE_RATE_MULTIPLIER: 1000
};

const PREDICTION_HORIZONS = {
  YEARS: [1, 2, 3, 5],
  MAX_YEARS: 5
};

const DATA_QUALITY = {
  MIN_DATA_POINTS: 3,
  MIN_POINTS_HIGH_CONFIDENCE: 20,
  MIN_SPAN_YEARS_MEDIUM: 2,
  MIN_SPAN_YEARS_HIGH: 5
};

const CONFIDENCE_THRESHOLDS = {
  R_SQUARED_HIGH: 0.7,
  R_SQUARED_MEDIUM: 0.5
};

const STRESS_THRESHOLDS = {
  SAFE_TO_SEMI: 0.1,
  SEMI_TO_CRITICAL: 0.5,
  CRITICAL_TO_OVEREXPLOITED: 1.0
};

const STRESS_TRANSITION = {
  STABLE_THRESHOLD: 0.01,
  SAFE_DEPTH_INCREASE: 0.20,
  SEMI_DEPTH_INCREASE: 0.30,
  CRITICAL_DEPTH_INCREASE: 0.40,
  MIN_TRANSITION_YEARS: 0.5,
  MAX_TRANSITION_YEARS: 20,
  PROXIMITY_ADJUSTMENT: 0.5,
  SAFE_STABLE_FACTOR: 0.5,
  HIGH_PRIORITY_YEARS: 5
};

const SEASONS = {
  PRE_MONSOON: {
    months: [1, 2, 3, 4, 5],
    name: 'pre-monsoon',
    displayPeriod: 'January-May'
  },
  POST_MONSOON: {
    months: [10, 11, 12],
    name: 'post-monsoon',
    displayPeriod: 'October-December'
  }
};

// Using Sets for O(1) month lookup instead of Array.includes() O(n)
const SEASON_MONTH_SETS = {
  PRE_MONSOON: new Set(SEASONS.PRE_MONSOON.months),
  POST_MONSOON: new Set(SEASONS.POST_MONSOON.months)
};

const SEASONAL_PREDICTION = {
  WINDOW_YEARS: 5,
  MIN_COMPLETE_CYCLES: 3,
  MID_SEASON_OFFSET: 0.5
};

function roundWaterLevel(value) {
  return Math.round(value * PRECISION.WATER_LEVEL_MULTIPLIER) / PRECISION.WATER_LEVEL_MULTIPLIER;
}

function roundDeclineRate(value) {
  return Math.round(value * PRECISION.DECLINE_RATE_MULTIPLIER) / PRECISION.DECLINE_RATE_MULTIPLIER;
}

export function computeFutureWaterLevels(history, slope, intercept, baseDate) {
  const filterResult = filterInvalidHistoricalData(history);
  const validHistory = filterResult.validData;
  
  if (filterResult.invalidCount > 0) {
    console.warn(`⚠️ Filtered ${filterResult.invalidCount} invalid records`);
  }
  
  const qualityCheck = checkDataQuality(validHistory, { minPoints: DATA_QUALITY.MIN_DATA_POINTS, minSpanYears: 0 });
  if (!qualityCheck.isValid) {
    throw new Error(qualityCheck.errors.join('; '));
  }
  
  const regressionValidation = validateRegressionParameters(slope, intercept);
  if (!regressionValidation.isValid) {
    throw new Error(`Invalid regression parameters: ${regressionValidation.errors.join('; ')}`);
  }
  
  if (!validateDate(baseDate)) {
    throw new Error(`Invalid baseDate: Expected valid Date object, received ${typeof baseDate}`);
  }
  
  const startDate = new Date(qualityCheck.metrics.startDate);
  const endDate = new Date(qualityCheck.metrics.endDate);
  
  // Linear regression formula: predictedLevel = intercept + (slope * years)
  const predictions = PREDICTION_HORIZONS.YEARS.map(years => {
    const predictedLevel = intercept + (slope * years);
    const predictionDate = new Date(baseDate);
    predictionDate.setFullYear(predictionDate.getFullYear() + years);
    
    return {
      year: years,
      date: predictionDate.toISOString().split('T')[0],
      predictedLevel: roundWaterLevel(predictedLevel),
      unit: 'meters below ground level'
    };
  });
  
  return {
    methodology: `Linear regression based on ${validHistory.length}-point historical trend`,
    dataRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    },
    predictions
  };
}

export function calculateConfidence(history, rSquared, dataSpanYears) {
  const filterResult = filterInvalidHistoricalData(history);
  const validHistory = filterResult.validData;
  
  validateNumericParameter(rSquared, 'rSquared');
  if (rSquared < 0 || rSquared > 1) {
    throw new Error(`Invalid rSquared: ${rSquared}. Must be between 0 and 1`);
  }
  
  validateNumericParameter(dataSpanYears, 'dataSpanYears');
  if (dataSpanYears < 0) {
    throw new Error(`Invalid dataSpanYears: ${dataSpanYears}. Must be non-negative`);
  }
  
  const dataPointCount = validHistory.length;
  const hasSufficientData = dataPointCount >= DATA_QUALITY.MIN_POINTS_HIGH_CONFIDENCE 
    && dataSpanYears >= DATA_QUALITY.MIN_SPAN_YEARS_MEDIUM;
  
  if (rSquared > CONFIDENCE_THRESHOLDS.R_SQUARED_HIGH 
      && dataSpanYears > DATA_QUALITY.MIN_SPAN_YEARS_HIGH 
      && hasSufficientData) {
    return 'high';
  }
  
  if (rSquared > CONFIDENCE_THRESHOLDS.R_SQUARED_MEDIUM 
      && dataSpanYears > DATA_QUALITY.MIN_SPAN_YEARS_MEDIUM) {
    return 'medium';
  }
  
  return 'low';
}



export function predictStressCategoryTransition(currentCategory, annualDeclineRate, currentWaterLevel) {
  if (typeof currentCategory !== 'string') {
    throw new Error(`Invalid currentCategory: Expected string, received ${typeof currentCategory}`);
  }
  
  validateNumericParameter(annualDeclineRate, 'annualDeclineRate');
  validateNumericParameter(currentWaterLevel, 'currentWaterLevel');
  
  const category = currentCategory.trim();
  const validCategories = ['Safe', 'Semi-critical', 'Critical', 'Over-exploited'];
  
  if (!validCategories.includes(category)) {
    throw new Error(`Invalid category: "${currentCategory}". Expected: ${validCategories.join(', ')}`);
  }
  
  const response = {
    currentCategory: category,
    currentDeclineRate: roundDeclineRate(annualDeclineRate),
    thresholds: {
      'Safe': { max: STRESS_THRESHOLDS.SAFE_TO_SEMI },
      'Semi-critical': { max: STRESS_THRESHOLDS.SEMI_TO_CRITICAL },
      'Critical': { max: STRESS_THRESHOLDS.CRITICAL_TO_OVEREXPLOITED },
      'Over-exploited': { min: STRESS_THRESHOLDS.CRITICAL_TO_OVEREXPLOITED }
    },
    predictions: null
  };
  
  if (category === 'Over-exploited') {
    response.predictions = {
      nextCategory: null,
      yearsUntilTransition: null,
      estimatedTransitionDate: null,
      message: 'Maximum stress level reached - no further category transition possible'
    };
    return response;
  }
  
  if (annualDeclineRate < 0) {
    response.predictions = {
      nextCategory: null,
      yearsUntilTransition: null,
      estimatedTransitionDate: null,
      message: 'Improving conditions - water levels are rising',
      trend: 'improving'
    };
    return response;
  }
  
  if (Math.abs(annualDeclineRate) < STRESS_TRANSITION.STABLE_THRESHOLD) {
    response.predictions = {
      nextCategory: null,
      yearsUntilTransition: null,
      estimatedTransitionDate: null,
      message: 'Stable conditions - minimal water level change',
      trend: 'stable'
    };
    return response;
  }
  
  let nextCategory = null;
  let thresholdRate = null;
  
  if (category === 'Safe') {
    nextCategory = 'Semi-critical';
    thresholdRate = STRESS_THRESHOLDS.SAFE_TO_SEMI;
    
    if (annualDeclineRate < thresholdRate * STRESS_TRANSITION.SAFE_STABLE_FACTOR) {
      response.predictions = {
        nextCategory: null,
        yearsUntilTransition: null,
        estimatedTransitionDate: null,
        message: 'Stable conditions - decline rate below transition threshold',
        trend: 'stable'
      };
      return response;
    }
  } else if (category === 'Semi-critical') {
    nextCategory = 'Critical';
    thresholdRate = STRESS_THRESHOLDS.SEMI_TO_CRITICAL;
  } else if (category === 'Critical') {
    nextCategory = 'Over-exploited';
    thresholdRate = STRESS_THRESHOLDS.CRITICAL_TO_OVEREXPLOITED;
  }
  
  if (annualDeclineRate >= thresholdRate) {
    response.predictions = {
      nextCategory: nextCategory,
      yearsUntilTransition: 0,
      estimatedTransitionDate: new Date().toISOString().split('T')[0],
      message: `Current decline rate (${roundDeclineRate(annualDeclineRate)} m/year) already exceeds ${nextCategory} threshold (${thresholdRate} m/year)`,
      warning: 'Immediate action required - threshold already exceeded'
    };
    return response;
  }
  
  const rateGap = thresholdRate - annualDeclineRate;
  
  // Calculate critical depth: how much deeper water needs to drop before stress accelerates
  // Safe: 20%, Semi-critical: 30%, Critical: 40% of current depth
  let depthIncreasePercentage;
  if (category === 'Safe') {
    depthIncreasePercentage = STRESS_TRANSITION.SAFE_DEPTH_INCREASE;
  } else if (category === 'Semi-critical') {
    depthIncreasePercentage = STRESS_TRANSITION.SEMI_DEPTH_INCREASE;
  } else if (category === 'Critical') {
    depthIncreasePercentage = STRESS_TRANSITION.CRITICAL_DEPTH_INCREASE;
  }
  
  const criticalDepthIncrease = currentWaterLevel * depthIncreasePercentage;
  let yearsUntilTransition = criticalDepthIncrease / annualDeclineRate;
  
  // Adjust for proximity to threshold: closer to threshold = faster transition
  const proximityFactor = 1 - (rateGap / thresholdRate);
  yearsUntilTransition = yearsUntilTransition * (1 - proximityFactor * STRESS_TRANSITION.PROXIMITY_ADJUSTMENT);
  
  // Clamp to reasonable bounds (6 months to 20 years)
  yearsUntilTransition = Math.max(STRESS_TRANSITION.MIN_TRANSITION_YEARS, yearsUntilTransition);
  yearsUntilTransition = Math.min(STRESS_TRANSITION.MAX_TRANSITION_YEARS, yearsUntilTransition);
  yearsUntilTransition = Math.round(yearsUntilTransition * 10) / 10;
  
  const transitionDate = new Date();
  transitionDate.setFullYear(transitionDate.getFullYear() + Math.floor(yearsUntilTransition));
  const remainingMonths = Math.round((yearsUntilTransition % 1) * 12);
  transitionDate.setMonth(transitionDate.getMonth() + remainingMonths);
  
  response.predictions = {
    nextCategory: nextCategory,
    yearsUntilTransition: yearsUntilTransition,
    estimatedTransitionDate: transitionDate.toISOString().split('T')[0]
  };
  
  if (yearsUntilTransition <= STRESS_TRANSITION.HIGH_PRIORITY_YEARS) {
    response.predictions.warning = 'High priority - transition expected within 5 years';
  }
  
  return response;
}



function getCurrentSeason(date) {
  const month = date.getMonth() + 1;
  
  if (SEASONS.PRE_MONSOON.months.includes(month)) {
    return SEASONS.PRE_MONSOON;
  } else if (SEASONS.POST_MONSOON.months.includes(month)) {
    return SEASONS.POST_MONSOON;
  } else {
    return SEASONS.PRE_MONSOON;
  }
}

function getNextSeason(currentSeason) {
  return currentSeason.name === 'pre-monsoon' ? SEASONS.POST_MONSOON : SEASONS.PRE_MONSOON;
}

function extractSeasonalData(history) {
  const seasonalData = { preMonsoon: [], postMonsoon: [] };
  
  for (let i = 0; i < history.length; i++) {
    const record = history[i];
    const waterLevel = record.waterLevel;
    
    if (isNullOrNaN(waterLevel)) continue;
    
    const date = new Date(record.date);
    if (!validateDate(date)) continue;
    
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    // Pre-monsoon: Jan-May, Post-monsoon: Oct-Dec (monsoon Jun-Sep excluded)
    if (SEASON_MONTH_SETS.PRE_MONSOON.has(month)) {
      seasonalData.preMonsoon.push({ year, waterLevel, date: record.date });
    } else if (SEASON_MONTH_SETS.POST_MONSOON.has(month)) {
      seasonalData.postMonsoon.push({ year, waterLevel, date: record.date });
    }
  }
  
  return seasonalData;
}

function calculateSeasonalAverage(seasonalRecords, windowYears = SEASONAL_PREDICTION.WINDOW_YEARS) {
  if (!seasonalRecords || seasonalRecords.length === 0) return null;
  
  const sorted = [...seasonalRecords].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  
  const mostRecentDate = new Date(sorted[0].date);
  const cutoffDate = new Date(mostRecentDate);
  cutoffDate.setFullYear(cutoffDate.getFullYear() - windowYears);
  
  const windowRecords = sorted.filter(record => new Date(record.date) >= cutoffDate);
  if (windowRecords.length === 0) return null;
  
  const sum = windowRecords.reduce((acc, record) => acc + record.waterLevel, 0);
  return roundWaterLevel(sum / windowRecords.length);
}

function countCompleteCycles(seasonalData) {
  const preMonsoonYears = new Set(seasonalData.preMonsoon.map(r => r.year));
  const postMonsoonYears = new Set(seasonalData.postMonsoon.map(r => r.year));
  
  let completeCycles = 0;
  preMonsoonYears.forEach(year => {
    if (postMonsoonYears.has(year)) completeCycles++;
  });
  
  return completeCycles;
}

function calculatePredictionDates(currentDate, currentSeason, nextSeason, followingSeason) {
  const currentYear = currentDate.getFullYear();
  
  // Handle year rollover: post-monsoon (Oct-Dec) → pre-monsoon (Jan-May) crosses year boundary
  let nextSeasonYear = currentYear;
  if (currentSeason.name === 'post-monsoon' && nextSeason.name === 'pre-monsoon') {
    nextSeasonYear = currentYear + 1;
  }
  
  let followingSeasonYear = nextSeasonYear;
  if (nextSeason.name === 'post-monsoon' && followingSeason.name === 'pre-monsoon') {
    followingSeasonYear = nextSeasonYear + 1;
  }
  
  return { nextSeasonYear, followingSeasonYear };
}

function applyTrendAdjustment(seasonalAverage, slope, yearsFromBase) {
  // Adjust historical average by overall trend: newLevel = average + (slope * years)
  return seasonalAverage + (slope * yearsFromBase);
}

function calculateRecharge(seasonName, previousLevel, predictedLevel) {
  // Positive recharge = water level decreased (aquifer recharged)
  // Negative recharge = water level increased (aquifer depleted)
  return roundWaterLevel(previousLevel - predictedLevel);
}

function validateSeasonalInputs(history, currentDate, slope) {
  const filterResult = filterInvalidHistoricalData(history);
  const validHistory = filterResult.validData;
  
  if (filterResult.invalidCount > 0) {
    console.warn(`⚠️ Filtered ${filterResult.invalidCount} invalid seasonal records`);
  }
  
  const qualityCheck = checkDataQuality(validHistory, { minPoints: DATA_QUALITY.MIN_DATA_POINTS, minSpanYears: 0 });
  if (!qualityCheck.isValid) {
    throw new Error(qualityCheck.errors.join('; '));
  }
  
  if (!validateDate(currentDate)) {
    throw new Error(`Invalid currentDate: Expected valid Date object, received ${typeof currentDate}`);
  }
  
  if (slope !== 0) {
    validateNumericParameter(slope, 'slope');
  }
  
  return { validHistory, qualityCheck };
}

function calculateSeasonalPredictions(params) {
  const {
    preMonsoonAverage, postMonsoonAverage, currentSeason, nextSeason, followingSeason,
    nextSeasonYear, followingSeasonYear, currentDate, slope, validHistory
  } = params;
  
  const baseYear = currentDate.getFullYear();
  const nextSeasonYearsFromBase = nextSeasonYear - baseYear + SEASONAL_PREDICTION.MID_SEASON_OFFSET;
  const followingSeasonYearsFromBase = followingSeasonYear - baseYear + SEASONAL_PREDICTION.MID_SEASON_OFFSET;
  
  const nextSeasonAverage = nextSeason.name === 'pre-monsoon' ? preMonsoonAverage : postMonsoonAverage;
  const followingSeasonAverage = followingSeason.name === 'pre-monsoon' ? preMonsoonAverage : postMonsoonAverage;
  
  const nextSeasonPredicted = applyTrendAdjustment(nextSeasonAverage, slope, nextSeasonYearsFromBase);
  const followingSeasonPredicted = applyTrendAdjustment(followingSeasonAverage, slope, followingSeasonYearsFromBase);
  
  const previousLevel = currentSeason.name === 'pre-monsoon' 
    ? (validHistory[validHistory.length - 1]?.waterLevel || preMonsoonAverage)
    : (validHistory[validHistory.length - 1]?.waterLevel || postMonsoonAverage);
  
  const nextSeasonRecharge = calculateRecharge(nextSeason.name, previousLevel, nextSeasonPredicted);
  const followingSeasonRecharge = calculateRecharge(followingSeason.name, nextSeasonPredicted, followingSeasonPredicted);
  
  return {
    nextSeasonPredicted, followingSeasonPredicted, nextSeasonAverage, followingSeasonAverage,
    nextSeasonRecharge, followingSeasonRecharge
  };
}

function buildSeasonalResponse(params) {
  const {
    currentSeason, nextSeason, followingSeason, nextSeasonYear, followingSeasonYear,
    nextSeasonPredicted, followingSeasonPredicted, nextSeasonAverage, followingSeasonAverage,
    nextSeasonRecharge, followingSeasonRecharge
  } = params;
  
  return {
    methodology: `${SEASONAL_PREDICTION.WINDOW_YEARS}-year seasonal average with trend adjustment`,
    currentSeason: currentSeason.name,
    nextSeason: {
      season: nextSeason.name,
      period: `${nextSeason.displayPeriod} ${nextSeasonYear}`,
      predictedLevel: roundWaterLevel(nextSeasonPredicted),
      historicalAverage: nextSeasonAverage,
      expectedRecharge: nextSeasonRecharge,
      unit: 'meters below ground level'
    },
    followingSeason: {
      season: followingSeason.name,
      period: `${followingSeason.displayPeriod} ${followingSeasonYear}`,
      predictedLevel: roundWaterLevel(followingSeasonPredicted),
      historicalAverage: followingSeasonAverage,
      expectedRecharge: followingSeasonRecharge,
      unit: 'meters below ground level'
    }
  };
}

export function predictSeasonalLevels(history, currentDate, slope = 0) {
  const { validHistory } = validateSeasonalInputs(history, currentDate, slope);
  const seasonalData = extractSeasonalData(validHistory);
  
  const completeCycles = countCompleteCycles(seasonalData);
  if (completeCycles < SEASONAL_PREDICTION.MIN_COMPLETE_CYCLES) {
    throw new Error(`Insufficient seasonal data: ${completeCycles} cycles found, ${SEASONAL_PREDICTION.MIN_COMPLETE_CYCLES} required`);
  }
  
  const preMonsoonAverage = calculateSeasonalAverage(seasonalData.preMonsoon, SEASONAL_PREDICTION.WINDOW_YEARS);
  const postMonsoonAverage = calculateSeasonalAverage(seasonalData.postMonsoon, SEASONAL_PREDICTION.WINDOW_YEARS);
  
  if (isNullOrNaN(preMonsoonAverage) || isNullOrNaN(postMonsoonAverage)) {
    throw new Error(`Unable to calculate seasonal averages. Pre: ${preMonsoonAverage}, Post: ${postMonsoonAverage}`);
  }
  
  const currentSeason = getCurrentSeason(currentDate);
  const nextSeason = getNextSeason(currentSeason);
  const followingSeason = getNextSeason(nextSeason);
  
  const { nextSeasonYear, followingSeasonYear } = calculatePredictionDates(
    currentDate, currentSeason, nextSeason, followingSeason
  );
  
  const predictions = calculateSeasonalPredictions({
    preMonsoonAverage, postMonsoonAverage, currentSeason, nextSeason, followingSeason,
    nextSeasonYear, followingSeasonYear, currentDate, slope, validHistory
  });
  
  return buildSeasonalResponse({
    currentSeason, nextSeason, followingSeason, nextSeasonYear, followingSeasonYear, ...predictions
  });
}
