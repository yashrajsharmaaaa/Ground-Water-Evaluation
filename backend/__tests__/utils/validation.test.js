/**
 * Tests for Data Validation Module
 * Validates Requirements 5.1, 5.2
 */

import {
  filterInvalidHistoricalData,
  validateRegressionParameters,
  checkDataQuality,
  validatePredictionInputs,
  validateSeasonalData,
  validateDate
} from '../../utils/validation.js';

describe('Data Validation Module', () => {
  describe('validateDate', () => {
    test('should return true for valid Date object', () => {
      const validDate = new Date('2020-01-01');
      expect(validateDate(validDate)).toBe(true);
    });
    
    test('should return true for current date', () => {
      const now = new Date();
      expect(validateDate(now)).toBe(true);
    });
    
    test('should return false for invalid Date object', () => {
      const invalidDate = new Date('invalid-date');
      expect(validateDate(invalidDate)).toBe(false);
    });
    
    test('should return false for null', () => {
      expect(validateDate(null)).toBe(false);
    });
    
    test('should return false for undefined', () => {
      expect(validateDate(undefined)).toBe(false);
    });
    
    test('should return false for string', () => {
      expect(validateDate('2020-01-01')).toBe(false);
    });
    
    test('should return false for number', () => {
      expect(validateDate(1234567890)).toBe(false);
    });
    
    test('should return false for object', () => {
      expect(validateDate({})).toBe(false);
    });
    
    test('should return false for array', () => {
      expect(validateDate([])).toBe(false);
    });
    
    test('should handle edge case dates', () => {
      // Very old date
      expect(validateDate(new Date('1900-01-01'))).toBe(true);
      
      // Future date
      expect(validateDate(new Date('2100-12-31'))).toBe(true);
      
      // Epoch
      expect(validateDate(new Date(0))).toBe(true);
    });
  });
  
  describe('filterInvalidHistoricalData', () => {
    test('should filter out null water levels', () => {
      const history = [
        { date: '2020-01-01', waterLevel: 10.5 },
        { date: '2020-02-01', waterLevel: null },
        { date: '2020-03-01', waterLevel: 11.2 }
      ];
      
      const result = filterInvalidHistoricalData(history);
      
      expect(result.validData).toHaveLength(2);
      expect(result.invalidCount).toBe(1);
      expect(result.validData[0].waterLevel).toBe(10.5);
      expect(result.validData[1].waterLevel).toBe(11.2);
    });
    
    test('should filter out NaN water levels', () => {
      const history = [
        { date: '2020-01-01', waterLevel: 10.5 },
        { date: '2020-02-01', waterLevel: NaN },
        { date: '2020-03-01', waterLevel: 11.2 }
      ];
      
      const result = filterInvalidHistoricalData(history);
      
      expect(result.validData).toHaveLength(2);
      expect(result.invalidCount).toBe(1);
    });
    
    test('should filter out undefined water levels', () => {
      const history = [
        { date: '2020-01-01', waterLevel: 10.5 },
        { date: '2020-02-01', waterLevel: undefined },
        { date: '2020-03-01', waterLevel: 11.2 }
      ];
      
      const result = filterInvalidHistoricalData(history);
      
      expect(result.validData).toHaveLength(2);
      expect(result.invalidCount).toBe(1);
    });
    
    test('should filter out infinite water levels', () => {
      const history = [
        { date: '2020-01-01', waterLevel: 10.5 },
        { date: '2020-02-01', waterLevel: Infinity },
        { date: '2020-03-01', waterLevel: 11.2 }
      ];
      
      const result = filterInvalidHistoricalData(history);
      
      expect(result.validData).toHaveLength(2);
      expect(result.invalidCount).toBe(1);
    });
    
    test('should filter out invalid dates', () => {
      const history = [
        { date: '2020-01-01', waterLevel: 10.5 },
        { date: 'invalid-date', waterLevel: 10.8 },
        { date: '2020-03-01', waterLevel: 11.2 }
      ];
      
      const result = filterInvalidHistoricalData(history);
      
      expect(result.validData).toHaveLength(2);
      expect(result.invalidCount).toBe(1);
    });
    
    test('should handle empty array', () => {
      const result = filterInvalidHistoricalData([]);
      
      expect(result.validData).toHaveLength(0);
      expect(result.invalidCount).toBe(0);
    });
    
    test('should throw error for non-array input', () => {
      // ERROR FIX: Updated to match enhanced error messages that include context
      expect(() => filterInvalidHistoricalData(null)).toThrow(/Invalid history parameter.*Expected an array/);
      expect(() => filterInvalidHistoricalData('not an array')).toThrow(/Invalid history parameter.*Expected an array/);
    });
  });
  
  describe('validateRegressionParameters', () => {
    test('should validate correct parameters', () => {
      const result = validateRegressionParameters(0.5, 10.2);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject null slope', () => {
      const result = validateRegressionParameters(null, 10.2);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('slope is null or undefined');
    });
    
    test('should reject NaN slope', () => {
      const result = validateRegressionParameters(NaN, 10.2);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('slope is NaN');
    });
    
    test('should reject infinite slope', () => {
      const result = validateRegressionParameters(Infinity, 10.2);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('slope is infinite');
    });
    
    test('should reject null intercept', () => {
      const result = validateRegressionParameters(0.5, null);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('intercept is null or undefined');
    });
    
    test('should reject NaN intercept', () => {
      const result = validateRegressionParameters(0.5, NaN);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('intercept is NaN');
    });
    
    test('should accept negative values', () => {
      const result = validateRegressionParameters(-0.5, -10.2);
      
      expect(result.isValid).toBe(true);
    });
    
    test('should accept zero values', () => {
      const result = validateRegressionParameters(0, 0);
      
      expect(result.isValid).toBe(true);
    });
  });
  
  describe('checkDataQuality', () => {
    test('should pass with sufficient data points', () => {
      const history = [
        { date: '2020-01-01', waterLevel: 10.5 },
        { date: '2020-02-01', waterLevel: 10.8 },
        { date: '2020-03-01', waterLevel: 11.2 }
      ];
      
      const result = checkDataQuality(history, { minPoints: 3, minSpanYears: 0 });
      
      expect(result.isValid).toBe(true);
      expect(result.metrics.dataPoints).toBe(3);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should fail with insufficient data points', () => {
      const history = [
        { date: '2020-01-01', waterLevel: 10.5 },
        { date: '2020-02-01', waterLevel: 10.8 }
      ];
      
      const result = checkDataQuality(history, { minPoints: 3, minSpanYears: 0 });
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Insufficient data points');
    });
    
    test('should calculate data span correctly', () => {
      const history = [
        { date: '2020-01-01', waterLevel: 10.5 },
        { date: '2021-01-01', waterLevel: 10.8 },
        { date: '2022-01-01', waterLevel: 11.2 }
      ];
      
      const result = checkDataQuality(history, { minPoints: 3, minSpanYears: 0 });
      
      expect(result.isValid).toBe(true);
      expect(result.metrics.dataSpanYears).toBeCloseTo(2, 1);
      expect(result.metrics.startDate).toBe('2020-01-01');
      expect(result.metrics.endDate).toBe('2022-01-01');
    });
    
    test('should fail with insufficient data span', () => {
      const history = [
        { date: '2020-01-01', waterLevel: 10.5 },
        { date: '2020-02-01', waterLevel: 10.8 },
        { date: '2020-03-01', waterLevel: 11.2 }
      ];
      
      const result = checkDataQuality(history, { minPoints: 3, minSpanYears: 2 });
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Insufficient data span'))).toBe(true);
    });
    
    test('should handle empty array', () => {
      const result = checkDataQuality([], { minPoints: 3, minSpanYears: 0 });
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('validatePredictionInputs', () => {
    test('should validate complete valid inputs', () => {
      const history = [
        { date: '2020-01-01', waterLevel: 10.5 },
        { date: '2021-01-01', waterLevel: 10.8 },
        { date: '2022-01-01', waterLevel: 11.2 }
      ];
      
      const result = validatePredictionInputs(history, 0.35, 10.5, { minPoints: 3, minSpanYears: 0 });
      
      expect(result.isValid).toBe(true);
      expect(result.validData).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should filter invalid data and still validate', () => {
      const history = [
        { date: '2020-01-01', waterLevel: 10.5 },
        { date: '2020-06-01', waterLevel: null },
        { date: '2021-01-01', waterLevel: 10.8 },
        { date: '2022-01-01', waterLevel: 11.2 }
      ];
      
      const result = validatePredictionInputs(history, 0.35, 10.5, { minPoints: 3, minSpanYears: 0 });
      
      // Should be valid because we have 3 valid records after filtering
      expect(result.isValid).toBe(true);
      expect(result.validData).toHaveLength(3);
      expect(result.errors).toHaveLength(0); // No errors
      expect(result.warnings.length).toBeGreaterThan(0); // Should have warning about filtered data
    });
    
    test('should fail with invalid regression parameters', () => {
      const history = [
        { date: '2020-01-01', waterLevel: 10.5 },
        { date: '2021-01-01', waterLevel: 10.8 },
        { date: '2022-01-01', waterLevel: 11.2 }
      ];
      
      const result = validatePredictionInputs(history, NaN, 10.5, { minPoints: 3, minSpanYears: 0 });
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('slope'))).toBe(true);
    });
    
    test('should fail when filtered data is insufficient', () => {
      const history = [
        { date: '2020-01-01', waterLevel: 10.5 },
        { date: '2020-02-01', waterLevel: null },
        { date: '2020-03-01', waterLevel: NaN }
      ];
      
      const result = validatePredictionInputs(history, 0.35, 10.5, { minPoints: 3, minSpanYears: 0 });
      
      expect(result.isValid).toBe(false);
      expect(result.validData).toHaveLength(1);
    });
  });
  
  describe('validateSeasonalData', () => {
    test('should validate sufficient seasonal cycles', () => {
      const rechargePattern = [
        { year: 2020, preMonsoonDepth: '10.5', postMonsoonDepth: '9.2', rechargeAmount: '1.3' },
        { year: 2021, preMonsoonDepth: '10.8', postMonsoonDepth: '9.5', rechargeAmount: '1.3' },
        { year: 2022, preMonsoonDepth: '11.2', postMonsoonDepth: '9.8', rechargeAmount: '1.4' }
      ];
      
      const result = validateSeasonalData(rechargePattern, 3);
      
      expect(result.isValid).toBe(true);
      expect(result.cycleCount).toBe(3);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should fail with insufficient seasonal cycles', () => {
      const rechargePattern = [
        { year: 2020, preMonsoonDepth: '10.5', postMonsoonDepth: '9.2', rechargeAmount: '1.3' },
        { year: 2021, preMonsoonDepth: '10.8', postMonsoonDepth: '9.5', rechargeAmount: '1.3' }
      ];
      
      const result = validateSeasonalData(rechargePattern, 3);
      
      expect(result.isValid).toBe(false);
      expect(result.cycleCount).toBe(2);
      expect(result.errors.some(e => e.includes('Insufficient seasonal cycles'))).toBe(true);
    });
    
    test('should filter incomplete cycles', () => {
      const rechargePattern = [
        { year: 2020, preMonsoonDepth: '10.5', postMonsoonDepth: '9.2', rechargeAmount: '1.3' },
        { year: 2021, preMonsoonDepth: '10.8', postMonsoonDepth: null, rechargeAmount: '1.3' },
        { year: 2022, preMonsoonDepth: '11.2', postMonsoonDepth: '9.8', rechargeAmount: '1.4' },
        { year: 2023, preMonsoonDepth: null, postMonsoonDepth: '9.9', rechargeAmount: '1.5' }
      ];
      
      const result = validateSeasonalData(rechargePattern, 2);
      
      expect(result.isValid).toBe(true);
      expect(result.cycleCount).toBe(2); // Only 2020 and 2022 are complete
    });
    
    test('should handle empty array', () => {
      const result = validateSeasonalData([], 3);
      
      expect(result.isValid).toBe(false);
      expect(result.cycleCount).toBe(0);
    });
    
    test('should throw error for non-array input', () => {
      const result = validateSeasonalData(null, 3);
      
      expect(result.isValid).toBe(false);
      // ERROR FIX: Updated to match enhanced error messages that include context
      expect(result.errors[0]).toMatch(/Invalid rechargePattern parameter.*Expected an array/);
    });
  });
});
