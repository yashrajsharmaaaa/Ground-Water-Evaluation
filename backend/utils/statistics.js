/**
 * Statistical Utilities Module
 * Provides statistical functions for prediction quality metrics
 */

import { isNullOrNaN } from './validation.js';

/**
 * Calculate R-squared (coefficient of determination)
 * R² measures how well the regression line fits the data (0 = no fit, 1 = perfect fit)
 * 
 * Formula: R² = 1 - (SS_res / SS_tot)
 * where SS_res = sum of squared residuals (errors)
 *       SS_tot = total sum of squares (variance from mean)
 * 
 * @param {Array<number>} actual - Actual observed values
 * @param {Array<number>} predicted - Predicted values from regression
 * @returns {number} R-squared value (0-1), or 0 if calculation fails
 */
export function calculateRSquared(actual, predicted) {
  // Input validation
  if (!Array.isArray(actual) || !Array.isArray(predicted)) {
    throw new Error('Both actual and predicted must be arrays');
  }
  
  if (actual.length === 0 || predicted.length === 0) {
    throw new Error('Arrays cannot be empty');
  }
  
  if (actual.length !== predicted.length) {
    throw new Error('Actual and predicted arrays must have the same length');
  }
  
  // Check for null, undefined, or NaN values using shared utility
  for (let i = 0; i < actual.length; i++) {
    if (isNullOrNaN(actual[i])) {
      throw new Error(`Invalid value in actual array at index ${i}`);
    }
    if (isNullOrNaN(predicted[i])) {
      throw new Error(`Invalid value in predicted array at index ${i}`);
    }
  }
  
  const n = actual.length;
  
  // Calculate mean of actual values
  const mean = actual.reduce((sum, val) => sum + val, 0) / n;
  
  // Calculate sum of squared residuals (SS_res)
  // This is the sum of squared differences between actual and predicted
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const residual = actual[i] - predicted[i];
    ssRes += residual * residual;
  }
  
  // Calculate total sum of squares (SS_tot)
  // This is the sum of squared differences from the mean
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const deviation = actual[i] - mean;
    ssTot += deviation * deviation;
  }
  
  // Handle edge case: if all actual values are the same (ssTot = 0)
  // R² is undefined, but we return 0 to indicate no predictive power
  if (ssTot === 0) {
    return 0;
  }
  
  // Calculate R²
  const rSquared = 1 - (ssRes / ssTot);
  
  // R² can technically be negative for very poor fits
  // but we clamp it to [0, 1] for practical use
  return Math.max(0, Math.min(1, rSquared));
}

/**
 * Calculate standard error of regression
 * Standard error measures the average distance that observed values fall from the regression line
 * Lower values indicate better fit
 * 
 * Formula: SE = sqrt(sum((actual - predicted)²) / (n - 2))
 * The (n-2) denominator accounts for degrees of freedom in linear regression
 * 
 * @param {Array<number>} actual - Actual observed values
 * @param {Array<number>} predicted - Predicted values from regression
 * @returns {number} Standard error value (always >= 0)
 */
export function calculateStandardError(actual, predicted) {
  // Input validation
  if (!Array.isArray(actual) || !Array.isArray(predicted)) {
    throw new Error('Both actual and predicted must be arrays');
  }
  
  if (actual.length === 0 || predicted.length === 0) {
    throw new Error('Arrays cannot be empty');
  }
  
  if (actual.length !== predicted.length) {
    throw new Error('Actual and predicted arrays must have the same length');
  }
  
  // Need at least 3 points for meaningful standard error in linear regression
  // (n-2 degrees of freedom must be positive)
  if (actual.length < 3) {
    throw new Error('Need at least 3 data points to calculate standard error');
  }
  
  // Check for null, undefined, or NaN values using shared utility
  for (let i = 0; i < actual.length; i++) {
    if (isNullOrNaN(actual[i])) {
      throw new Error(`Invalid value in actual array at index ${i}`);
    }
    if (isNullOrNaN(predicted[i])) {
      throw new Error(`Invalid value in predicted array at index ${i}`);
    }
  }
  
  const n = actual.length;
  
  // Calculate sum of squared residuals
  let sumSquaredResiduals = 0;
  for (let i = 0; i < n; i++) {
    const residual = actual[i] - predicted[i];
    sumSquaredResiduals += residual * residual;
  }
  
  // Calculate standard error
  // Use (n-2) for degrees of freedom in simple linear regression
  const standardError = Math.sqrt(sumSquaredResiduals / (n - 2));
  
  return standardError;
}
