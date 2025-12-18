
/**
 * Global error handler middleware
 * Converts all errors to standardized format
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  const timestamp = new Date().toISOString();

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      detail: Object.values(err.errors).map(e => e.message).join('; '),
      timestamp
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({
      error: 'Duplicate Entry',
      detail: 'A record with this value already exists',
      timestamp
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid Token',
      detail: 'The provided token is invalid',
      timestamp
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token Expired',
      detail: 'Your session has expired. Please login again',
      timestamp
    });
  }

  // Default error
  const response = {
    error: err.message || 'Internal Server Error',
    timestamp
  };

  // Add detail if available
  if (err.detail) {
    response.detail = err.detail;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.stack = err.stack;
  }

  res.status(err.status || 500).json(response);
};

/**
 * 404 handler - standardized format
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    detail: `Route ${req.method} ${req.url} not found`,
    timestamp: new Date().toISOString()
  });
};
