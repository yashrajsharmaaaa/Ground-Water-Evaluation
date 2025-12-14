import { logger } from './logger.js';

const requiredEnvVars = [
  'OPENROUTER_API_KEY',
  'SESSION_SECRET',
  'JWT_SECRET',
  'MONGODB_URI',
];

const optionalEnvVars = {
  PORT: '3000',
  NODE_ENV: 'development',
  LOG_LEVEL: 'INFO',
  ALLOWED_ORIGINS: 'http://localhost:8081',
  BASE_URL: 'http://localhost:3000',
};

export const validateEnv = () => {
  const missing = [];
  const warnings = [];

  // Check required variables
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    } else if (process.env[varName].includes('your-') || process.env[varName].includes('example')) {
      warnings.push(`${varName} appears to be a placeholder value`);
    }
  }

  // Set defaults for optional variables
  for (const [varName, defaultValue] of Object.entries(optionalEnvVars)) {
    if (!process.env[varName]) {
      process.env[varName] = defaultValue;
      logger.debug(`Using default for ${varName}: ${defaultValue}`);
    }
  }

  // Validate JWT_SECRET and SESSION_SECRET are different
  if (process.env.JWT_SECRET === process.env.SESSION_SECRET) {
    warnings.push('JWT_SECRET and SESSION_SECRET should be different');
  }

  // Validate secrets are strong enough
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters');
  }

  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
    warnings.push('SESSION_SECRET should be at least 32 characters');
  }

  // Report issues
  if (missing.length > 0) {
    logger.error('Missing required environment variables:', { missing });
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (warnings.length > 0) {
    warnings.forEach(warning => logger.warn(warning));
  }

  logger.info('Environment validation passed');
};
