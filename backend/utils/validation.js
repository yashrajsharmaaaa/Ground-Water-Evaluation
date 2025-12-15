export function validateDate(date) {
  return date instanceof Date && !isNaN(date.getTime());
}

export function isValidNumber(value) {
  return value !== null && 
         value !== undefined && 
         typeof value === 'number' && 
         !isNaN(value) && 
         isFinite(value);
}

export function validateNumericParameter(value, paramName) {
  if (value === null || value === undefined) {
    throw new Error(`Invalid ${paramName}: Cannot be null or undefined`);
  }
  
  if (typeof value !== 'number') {
    throw new Error(`Invalid ${paramName}: Expected number, received ${typeof value}`);
  }
  
  if (isNaN(value)) {
    throw new Error(`Invalid ${paramName}: Value is NaN`);
  }
  
  if (!isFinite(value)) {
    throw new Error(`Invalid ${paramName}: Value must be finite, received ${value}`);
  }
}

export function isNullOrNaN(value) {
  return value === null || value === undefined || (typeof value === 'number' && isNaN(value));
}

export function filterInvalidHistoricalData(history) {
  if (!Array.isArray(history)) {
    throw new Error(`Invalid history: Expected array, received ${typeof history}`);
  }
  
  const validData = [];
  const errors = [];
  let invalidCount = 0;
  
  history.forEach((record, index) => {
    if (!record || typeof record !== 'object') {
      invalidCount++;
      errors.push(`Record ${index} is not an object`);
      return;
    }
    
    const date = record.date;
    if (!date) {
      invalidCount++;
      errors.push(`Record ${index} missing date`);
      return;
    }
    
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      invalidCount++;
      errors.push(`Record ${index} invalid date: ${date}`);
      return;
    }
    
    const waterLevel = record.waterLevel;
    
    if (isNullOrNaN(waterLevel)) {
      invalidCount++;
      errors.push(`Record ${index} invalid water level: ${waterLevel}`);
      return;
    }
    
    if (typeof waterLevel !== 'number') {
      invalidCount++;
      errors.push(`Record ${index} non-numeric water level: ${waterLevel}`);
      return;
    }
    
    if (!isFinite(waterLevel)) {
      invalidCount++;
      errors.push(`Record ${index} infinite water level: ${waterLevel}`);
      return;
    }
    
    validData.push({ date: record.date, waterLevel: waterLevel });
  });
  
  return { validData, invalidCount, errors };
}

export function validateRegressionParameters(slope, intercept) {
  const errors = [];
  
  if (!isValidNumber(slope)) {
    if (slope === null || slope === undefined) {
      errors.push('slope is null or undefined');
    } else if (typeof slope !== 'number') {
      errors.push(`slope must be number, got ${typeof slope}`);
    } else if (isNaN(slope)) {
      errors.push('slope is NaN');
    } else if (!isFinite(slope)) {
      errors.push('slope is infinite');
    }
  }
  
  if (!isValidNumber(intercept)) {
    if (intercept === null || intercept === undefined) {
      errors.push('intercept is null or undefined');
    } else if (typeof intercept !== 'number') {
      errors.push(`intercept must be number, got ${typeof intercept}`);
    } else if (isNaN(intercept)) {
      errors.push('intercept is NaN');
    } else if (!isFinite(intercept)) {
      errors.push('intercept is infinite');
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

export function checkDataQuality(history, options = {}) {
  const { minPoints = 3, minSpanYears = 0 } = options;
  
  const errors = [];
  const metrics = { dataPoints: 0, dataSpanYears: 0, startDate: null, endDate: null };
  
  if (!Array.isArray(history)) {
    errors.push(`Invalid history: Expected array, received ${typeof history}`);
    return { isValid: false, metrics, errors };
  }
  
  metrics.dataPoints = history.length;
  
  if (metrics.dataPoints < minPoints) {
    errors.push(`Insufficient data: ${metrics.dataPoints} records, need ${minPoints}`);
  }
  
  if (history.length > 0) {
    const dates = history
      .map(h => new Date(h.date))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (dates.length === 0) {
      errors.push('No valid dates found');
    } else if (dates.length === 1) {
      metrics.startDate = dates[0].toISOString().split('T')[0];
      metrics.endDate = dates[0].toISOString().split('T')[0];
      metrics.dataSpanYears = 0;
      
      if (minSpanYears > 0) {
        errors.push(`Insufficient span: 0 years, need ${minSpanYears}`);
      }
    } else {
      const startDate = dates[0];
      const endDate = dates[dates.length - 1];
      
      metrics.startDate = startDate.toISOString().split('T')[0];
      metrics.endDate = endDate.toISOString().split('T')[0];
      
      const spanMs = endDate.getTime() - startDate.getTime();
      metrics.dataSpanYears = spanMs / (1000 * 60 * 60 * 24 * 365.25);
      
      if (metrics.dataSpanYears < minSpanYears) {
        errors.push(`Insufficient span: ${metrics.dataSpanYears.toFixed(2)} years, need ${minSpanYears}`);
      }
    }
  }
  
  return { isValid: errors.length === 0, metrics, errors };
}

export function validatePredictionInputs(history, slope, intercept, options = {}) {
  const allErrors = [];
  const warnings = [];
  let validData = [];
  let metrics = {};
  
  try {
    const filterResult = filterInvalidHistoricalData(history);
    validData = filterResult.validData;
    
    if (filterResult.invalidCount > 0) {
      warnings.push(`Filtered ${filterResult.invalidCount} invalid records`);
    }
  } catch (error) {
    allErrors.push(`Failed to filter data: ${error.message}`);
    return { isValid: false, validData: [], errors: allErrors, warnings, metrics: {} };
  }
  
  const regressionValidation = validateRegressionParameters(slope, intercept);
  if (!regressionValidation.isValid) {
    allErrors.push(...regressionValidation.errors);
  }
  
  const qualityCheck = checkDataQuality(validData, options);
  metrics = qualityCheck.metrics;
  
  if (!qualityCheck.isValid) {
    allErrors.push(...qualityCheck.errors);
  }
  
  const isValid = allErrors.length === 0;
  
  return { isValid, validData, errors: allErrors, warnings, metrics };
}

export function validateSeasonalData(rechargePattern, minCycles = 3) {
  const errors = [];
  
  if (!Array.isArray(rechargePattern)) {
    errors.push(`Invalid rechargePattern: Expected array, received ${typeof rechargePattern}`);
    return { isValid: false, cycleCount: 0, errors };
  }
  
  const completeCycles = rechargePattern.filter(record => {
    return record.preMonsoonDepth !== null && 
           record.preMonsoonDepth !== undefined &&
           record.postMonsoonDepth !== null &&
           record.postMonsoonDepth !== undefined &&
           !isNaN(parseFloat(record.preMonsoonDepth)) &&
           !isNaN(parseFloat(record.postMonsoonDepth));
  }).length;
  
  if (completeCycles < minCycles) {
    errors.push(`Insufficient cycles: ${completeCycles} found, ${minCycles} required`);
  }
  
  return { isValid: errors.length === 0, cycleCount: completeCycles, errors };
}
