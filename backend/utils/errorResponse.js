/**
 * Standardized Error Response Utility
 * Ensures consistent error format across all endpoints
 */

/**
 * Create standardized error response
 * @param {string} error - Main error message
 * @param {string} [detail] - Additional context
 * @returns {Object} Standardized error object
 */
export function createErrorResponse(error, detail = null) {
  const response = {
    error,
    timestamp: new Date().toISOString()
  };
  
  if (detail) {
    response.detail = detail;
  }
  
  return response;
}

/**
 * Create validation error response with multiple details
 * @param {string} error - Main error message
 * @param {Array<string>} details - Array of validation errors
 * @returns {Object} Standardized validation error
 */
export function createValidationError(error, details = []) {
  return {
    error,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * Express middleware to standardize all error responses
 */
export function standardizeErrorResponse(err, req, res, next) {
  // If response already sent, skip
  if (res.headersSent) {
    return next(err);
  }
  
  // Determine status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Create standardized response
  const errorResponse = createErrorResponse(
    err.message || 'Internal Server Error',
    err.detail || null
  );
  
  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
}
