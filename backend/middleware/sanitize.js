import { logger } from '../utils/logger.js';

const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  // Remove $, {, } (MongoDB operators), .. (path traversal), and trim whitespace
  return str
    .replace(/[${}]/g, '')
    .replace(/\.\./g, '')
    .trim();
};

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    const cleanKey = sanitizeString(key);
    
    if (typeof value === 'string') {
      sanitized[cleanKey] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[cleanKey] = sanitizeObject(value);
    } else {
      sanitized[cleanKey] = value;
    }
  }
  
  return sanitized;
};

export const sanitizeInput = (req, res, next) => {
  try {
    // Express 5 changed req.query to be read-only, so we need to check if it's writable
    if (req.body && Object.keys(req.body).length > 0) {
      req.body = sanitizeObject(req.body);
    }
    
    // Skip query sanitization for GET requests with no query params
    if (req.query && Object.keys(req.query).length > 0) {
      try {
        req.query = sanitizeObject(req.query);
      } catch (e) {
        // Express 5 may have read-only query, skip sanitization
        console.warn('Query sanitization skipped (read-only)');
      }
    }
    
    if (req.params && Object.keys(req.params).length > 0) {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    logger.error('Input sanitization error:', { error: error.message });
    res.status(400).json({ error: 'Invalid input format' });
  }
};

export const preventNoSQLInjection = (req, res, next) => {
  // Check for MongoDB query operators that could be used for injection
  const checkForInjection = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    
    const str = JSON.stringify(obj);
    const patterns = [
      /\$where/i,   // JavaScript execution
      /\$ne/i,      // Not equal (bypass auth)
      /\$gt/i,      // Greater than
      /\$lt/i,      // Less than
      /\$regex/i,   // Regex injection
      /\$or/i,      // OR logic manipulation
      /\$and/i,     // AND logic manipulation
    ];
    
    return patterns.some(pattern => pattern.test(str));
  };
  
  if (checkForInjection(req.body) || checkForInjection(req.query) || checkForInjection(req.params)) {
    logger.warn('Potential NoSQL injection attempt detected', {
      ip: req.ip,
      path: req.path,
    });
    return res.status(400).json({ error: 'Invalid request format' });
  }
  
  next();
};
