const redis = require('redis');
const logger = require('../utils/logger');
const { safeGetEnv } = require('../utils/commandSecurityUtils');

const client = redis.createClient({
  socket: {
    host: safeGetEnv('REDIS_HOST', '127.0.0.1', { isHost: true }),
    port: parseInt(safeGetEnv('REDIS_PORT', '6379', { isPort: true })) || 6379,
    connectTimeout: 10000, // Reduced from 60000
    commandTimeout: 5000,
    lazyConnect: true
  },
  password: safeGetEnv('REDIS_PASSWORD', undefined, { allowEmpty: true, maxLength: 255 }) || undefined,
  database: parseInt(safeGetEnv('REDIS_DB', '0', { isNumeric: true })) || 0,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Enhanced event handlers
client.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

client.on('connect', () => {
  logger.info('Redis client connected');
});

client.on('ready', () => {
  logger.info('Redis client ready');
});

client.on('end', () => {
  logger.warn('Redis client connection ended');
});

client.on('reconnecting', () => {
  logger.info('Redis client reconnecting...');
});

// Improved connection with error handling
const connectRedis = async () => {
  try {
    if (!client.isOpen) {
      await client.connect();
      logger.info('Redis connection established successfully');
    }
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    // Don't throw - let the application continue without Redis
  }
};

// Connect to Redis
connectRedis();

// Graceful shutdown handler
const gracefulShutdown = async () => {
  try {
    if (client.isOpen) {
      await client.quit();
      logger.info('Redis connection closed gracefully');
    }
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }
};

// Export both client and shutdown function
module.exports = {
  client,
  gracefulShutdown
};