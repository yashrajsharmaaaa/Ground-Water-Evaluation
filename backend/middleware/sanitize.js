import { logger } from '../utils/logger.js';

const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  // Remove potential NoSQL injection patterns
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
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    logger.error('Input sanitization error:', { error: error.message });
    res.status(400).json({ error: 'Invalid input format' });
  }
};

export const preventNoSQLInjection = (req, res, next) => {
  const checkForInjection = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    
    const str = JSON.stringify(obj);
    const patterns = [
      /\$where/i,
      /\$ne/i,
      /\$gt/i,
      /\$lt/i,
      /\$regex/i,
      /\$or/i,
      /\$and/i,
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
