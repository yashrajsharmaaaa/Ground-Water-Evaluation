const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const CURRENT_LEVEL = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] 
  : LOG_LEVELS.INFO;

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

const formatMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] ${level}: ${message}${metaStr}`;
};

export const logger = {
  error: (message, meta = {}) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.ERROR) {
      console.error(`${colors.red}${formatMessage('ERROR', message, meta)}${colors.reset}`);
    }
  },
  
  warn: (message, meta = {}) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.WARN) {
      console.warn(`${colors.yellow}${formatMessage('WARN', message, meta)}${colors.reset}`);
    }
  },
  
  info: (message, meta = {}) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.INFO) {
      console.log(`${colors.green}${formatMessage('INFO', message, meta)}${colors.reset}`);
    }
  },
  
  debug: (message, meta = {}) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
      console.log(`${colors.gray}${formatMessage('DEBUG', message, meta)}${colors.reset}`);
    }
  },
  
  http: (message, meta = {}) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.INFO) {
      console.log(`${colors.blue}${formatMessage('HTTP', message, meta)}${colors.reset}`);
    }
  },
};
