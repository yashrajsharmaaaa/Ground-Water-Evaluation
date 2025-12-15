/**
 * Precision Standardization Tests
 * Verifies that all numeric values are rounded to consistent precision
 * Per Requirement 9.5: Standardize numeric precision
 */

import { 
  computeFutureWaterLevels, 
  predictStressCategoryTransition,
  predictSeasonalLevels 
} from '../../utils/predictions.js';

describe('Numeric Precision Standardization (Requirement 9.5)', () => {
  
  describe('Water Level Precision (2 decimal places)', () => {
    
    test('future predictions round water levels to 2 decimal places', () => {
      const history = [
        { date: '2020-01-01', waterLevel: 10.123456 },
        { date: '2021-01-01', waterLevel: 10.789012 },
        { date: '2022-01-01', waterLevel: 11.345678 }
      ];
      
      const result = computeFutureWaterLevels(
        history, 
        0.611111, // Slope that will produce non-round numbers
        10.123456, // Intercept with many decimals
        new Date('2022-01-01')
      );
      
      // All predicted levels should have exactly 2 decimal places
      result.predictions.forEach(prediction => {
        const levelStr = prediction.predictedLevel.toString();
        const decimalPart = levelStr.split('.')[1];
        
        // Should have at most 2 decimal places
        expect(decimalPart ? decimalPart.length : 0).toBeLessThanOrEqual(2);
        
        // Verify it's properly rounded (not truncated)
        const expected = Math.round((10.123456 + 0.611111 * prediction.year) * 100) / 100;
        expect(prediction.predictedLevel).toBe(expected);
      });
    });
    
    test('seasonal predictions round water levels to 2 decimal places', () => {
      // Create seasonal data with precise values
      const history = [];
      for (let year = 2018; year <= 2022; year++) {
        history.push({ date: `${year}-02-15`, waterLevel: 10.123456 + (year - 2018) * 0.333333 });
        history.push({ date: `${year}-11-15`, waterLevel: 9.876543 + (year - 2018) * 0.333333 });
      }
      
      const result = predictSeasonalLevels(
        history,
        new Date('2023-01-15'),
        0.333333 // Slope with many decimals
      );
      
      // Check next season predicted level
      const nextLevelStr = result.nextSeason.predictedLevel.toString();
      const nextDecimalPart = nextLevelStr.split('.')[1];
      expect(nextDecimalPart ? nextDecimalPart.length : 0).toBeLessThanOrEqual(2);
      
      // Check following season predicted level
      const followingLevelStr = result.followingSeason.predictedLevel.toString();
      const followingDecimalPart = followingLevelStr.split('.')[1];
      expect(followingDecimalPart ? followingDecimalPart.length : 0).toBeLessThanOrEqual(2);
      
      // Check expected recharge values
      const nextRechargeStr = result.nextSeason.expectedRecharge.toString();
      const nextRechargeDecimal = nextRechargeStr.split('.')[1];
      expect(nextRechargeDecimal ? nextRechargeDecimal.length : 0).toBeLessThanOrEqual(2);
      
      const followingRechargeStr = result.followingSeason.expectedRecharge.toString();
      const followingRechargeDecimal = followingRechargeStr.split('.')[1];
      expect(followingRechargeDecimal ? followingRechargeDecimal.length : 0).toBeLessThanOrEqual(2);
    });
    
  });
  
  describe('Decline Rate Precision (3 decimal places)', () => {
    
    test('stress category transition rounds decline rate to 3 decimal places', () => {
      // Use a decline rate with many decimal places
      const result = predictStressCategoryTransition(
        'Safe',
        0.0753456789, // Many decimal places
        10.5
      );
      
      // Should be rounded to 3 decimal places
      expect(result.currentDeclineRate).toBe(0.075);
      
      // Verify it's exactly 3 decimal places
      const rateStr = result.currentDeclineRate.toString();
      const decimalPart = rateStr.split('.')[1];
      expect(decimalPart ? decimalPart.length : 0).toBeLessThanOrEqual(3);
    });
    
    test('decline rate rounding is consistent across different values', () => {
      const testCases = [
        { input: 0.1234567, expected: 0.123 },
        { input: 0.9876543, expected: 0.988 },
        { input: 0.0005, expected: 0.001 },
        { input: 0.0004, expected: 0 },
        { input: 1.2345, expected: 1.235 },
        { input: 0.5555, expected: 0.556 }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const result = predictStressCategoryTransition('Safe', input, 10);
        expect(result.currentDeclineRate).toBe(expected);
      });
    });
    
  });
  
  describe('Consistency Across All Functions', () => {
    
    test('all water level outputs use consistent 2-decimal precision', () => {
      const history = [
        { date: '2020-01-01', waterLevel: 10.111111 },
        { date: '2021-01-01', waterLevel: 10.777777 },
        { date: '2022-01-01', waterLevel: 11.333333 }
      ];
      
      const futureResult = computeFutureWaterLevels(
        history,
        0.666666,
        10.111111,
        new Date('2022-01-01')
      );
      
      // Check all predictions
      futureResult.predictions.forEach(pred => {
        const str = pred.predictedLevel.toString();
        const decimals = str.split('.')[1];
        expect(decimals ? decimals.length : 0).toBeLessThanOrEqual(2);
      });
    });
    
    test('precision is maintained through calculations', () => {
      // Test that intermediate calculations don't introduce precision errors
      const history = [];
      for (let i = 0; i < 10; i++) {
        history.push({
          date: `202${i % 3}-0${(i % 5) + 1}-15`,
          waterLevel: 10 + i * 0.333333
        });
      }
      
      const result = computeFutureWaterLevels(
        history,
        0.333333,
        10.123456,
        new Date('2022-01-01')
      );
      
      // Verify no floating point precision errors
      result.predictions.forEach(pred => {
        // Should be a clean number with at most 2 decimals
        expect(pred.predictedLevel).toBe(Math.round(pred.predictedLevel * 100) / 100);
      });
    });
    
  });
  
});
