/**
 * Service Status Controller - Provides status information for Redis and Kafka services
 * Also includes Redis cache management functionality
 */
const redis = require('redis');
const { client } = require('../database/redisClient');
const kafka = require('../kafka/kafkaClient');
const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');
const { sanitizeRedisKey } = require('../utils/redisSecurityUtils');

// Redis Cache Key Sanitization Utility (Legacy - use redisSecurityUtils instead)
const sanitizeRedisKeyLocal = (key) => {
  if (typeof key !== 'string' && typeof key !== 'number') {
    throw new Error('Invalid Redis key type');
  }
  
  // Convert to string and sanitize
  const sanitized = String(key)
    .replace(/[^a-zA-Z0-9:_\-\.@]/g, '_') // Replace invalid characters with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .substring(0, 250); // Limit key length
  
  if (sanitized.length === 0) {
    throw new Error('Redis key cannot be empty after sanitization');
  }
  
  return sanitized;
};

/**
 * Check if Redis is online and responding
 */
const getRedisStatus = async (req, res) => {
    try {
        const startTime = Date.now();
        
        // Create a connection specifically for this check
        const checkClient = client.isOpen ? client : redis.createClient({
            socket: {
                host: process.env.REDIS_HOST || '172.33.0.107',
                port: process.env.REDIS_PORT || 6379,
                connectTimeout: 5000,
                commandTimeout: 5000
            },
            password: process.env.REDIS_PASSWORD || undefined,
            database: process.env.REDIS_DB || 0,
        });
        
        if (!checkClient.isOpen) {
            await checkClient.connect();
        }

        // Test connection with PING
        await checkClient.ping();
        
        // Get some server info
        const info = await checkClient.info();
        const memory = await checkClient.info('memory');
        const clients = await checkClient.info('clients');
        
        // Only disconnect if we created a new client
        if (checkClient !== client) {
            await checkClient.quit();
        }

        const responseTime = Date.now() - startTime;
        
        // Parse interesting parts of info
        const memoryMatch = memory.match(/used_memory_human:(\S+)/);
        const clientsMatch = clients.match(/connected_clients:(\d+)/);
        const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/);
        
        res.status(200).json({
            status: 'OK',
            message: 'Redis is connected and responsive',
            details: {
                responseTime: `${responseTime}ms`,
                host: process.env.REDIS_HOST || '172.33.0.107',
                port: process.env.REDIS_PORT || 6379,
                memory: memoryMatch ? memoryMatch[1] : 'Unknown',
                connectedClients: clientsMatch ? parseInt(clientsMatch[1]) : 'Unknown',
                uptime: uptimeMatch ? formatUptime(parseInt(uptimeMatch[1])) : 'Unknown'
            }
        });
    } catch (error) {
        logger.error(`Redis status check failed: ${error.message}`);
        res.status(503).json({
            status: 'Error',
            message: `Redis connection failed: ${error.message}`,
            details: {
                host: process.env.REDIS_HOST || '172.33.0.107',
                port: process.env.REDIS_PORT || 6379
            }
        });
    }
};

/**
 * Check if Kafka is online and responding
 */
const getKafkaStatus = async (req, res) => {
    try {
        const startTime = Date.now();
        
        // Create a new Kafka instance for this check
        const kafkaInstance = new Kafka({
            clientId: 'status-checker',
            brokers: [process.env.KAFKA_BROKER || '172.33.0.107:9092'],
            connectionTimeout: 5000,
            requestTimeout: 5000
        });

        const admin = kafkaInstance.admin();
        await admin.connect();
        
        // Get cluster information
        const topics = await admin.listTopics();
        const brokers = await admin.describeCluster();

        await admin.disconnect();
        
        const responseTime = Date.now() - startTime;

        res.status(200).json({
            status: 'OK',
            message: 'Kafka is connected and responsive',
            details: {
                responseTime: `${responseTime}ms`,
                broker: process.env.KAFKA_BROKER || '172.33.0.107:9092',
                topics: topics,
                brokerCount: brokers.brokers.length,
                controllerId: brokers.controllerId
            }
        });
    } catch (error) {
        logger.error(`Kafka status check failed: ${error.message}`);
        res.status(503).json({
            status: 'Error',
            message: `Kafka connection failed: ${error.message}`,
            details: {
                broker: process.env.KAFKA_BROKER || '172.33.0.107:9092'
            }
        });
    }
};

/**
 * Format uptime in seconds to human readable format
 */
/**
 * Get all cache keys from Redis with their TTL and values
 */
const getAllCacheKeys = async (req, res) => {
    try {
        const startTime = Date.now();

        // Create a connection specifically for this check if needed
        const checkClient = client.isOpen ? client : redis.createClient({
            socket: {
                host: process.env.REDIS_HOST || '172.33.0.107',
                port: process.env.REDIS_PORT || 6379,
                connectTimeout: 5000,
                commandTimeout: 5000
            },
            password: process.env.REDIS_PASSWORD || undefined,
            database: process.env.REDIS_DB || 0,
        });
        
        if (!checkClient.isOpen) {
            await checkClient.connect();
        }

        // Get all keys (using SCAN for production safety instead of KEYS)
        const scanResults = [];
        let cursor = 0;
        do {
            const result = await checkClient.scan(cursor, { COUNT: 100 });
            cursor = result.cursor;
            scanResults.push(...result.keys);
        } while (cursor !== 0);

        // Get TTL and value for each key
        const keyDetails = await Promise.all(scanResults.map(async (key) => {
            try {
                const ttl = await checkClient.ttl(key);
                
                // Get value type
                const type = await checkClient.type(key);
                
                // Get value preview (first 100 chars or elements)
                let valuePreview = '';
                let fullValue = '';
                let size = 0;
                
                switch (type) {
                    case 'string':
                        fullValue = await checkClient.get(key);
                        valuePreview = fullValue.substring(0, 100) + (fullValue.length > 100 ? '...' : '');
                        size = fullValue.length;
                        break;
                    case 'list':
                        size = await checkClient.lLen(key);
                        const listItems = await checkClient.lRange(key, 0, 5);
                        valuePreview = JSON.stringify(listItems) + (size > 5 ? `... (${size} items total)` : '');
                        break;
                    case 'set':
                        size = await checkClient.sCard(key);
                        const setMembers = await checkClient.sMembers(key, 0, 5);
                        valuePreview = JSON.stringify(setMembers) + (size > 5 ? `... (${size} items total)` : '');
                        break;
                    case 'hash':
                        size = await checkClient.hLen(key);
                        const hashFields = await checkClient.hGetAll(key);
                        valuePreview = JSON.stringify(hashFields);
                        if (valuePreview.length > 100) {
                            valuePreview = valuePreview.substring(0, 100) + `... (${size} fields total)`;
                        }
                        break;
                    default:
                        valuePreview = `[${type} type]`;
                }
                
                return {
                    key,
                    ttl: ttl === -1 ? 'No expiration' : ttl === -2 ? 'Expired/Not found' : `${ttl}s`,
                    type,
                    size,
                    valuePreview
                };
            } catch (err) {
                return {
                    key,
                    ttl: 'Error',
                    type: 'Error',
                    valuePreview: `Error: ${err.message}`,
                    error: true
                };
            }
        }));

        // Only disconnect if we created a new client
        if (checkClient !== client) {
            await checkClient.quit();
        }

        // Sort keys alphabetically
        const sortedKeyDetails = keyDetails.sort((a, b) => a.key.localeCompare(b.key));

        const responseTime = Date.now() - startTime;
        
        res.status(200).json({
            status: 'OK',
            message: `Retrieved ${sortedKeyDetails.length} cache keys`,
            responseTime: `${responseTime}ms`,
            keys: sortedKeyDetails
        });
    } catch (error) {
        logger.error(`Redis cache keys retrieval failed: ${error.message}`);
        res.status(503).json({
            status: 'Error',
            message: `Failed to retrieve Redis cache keys: ${error.message}`,
            details: {
                host: process.env.REDIS_HOST || '172.33.0.107',
                port: process.env.REDIS_PORT || 6379
            }
        });
    }
};

/**
 * Delete a specific cache key from Redis
 */
const deleteCacheKey = async (req, res) => {
    const { key } = req.params;
    
    if (!key) {
        return res.status(400).json({
            status: 'Error',
            message: 'Key parameter is required'
        });
    }
    
    try {
        // Sanitize the Redis key to prevent NoSQL injection
        const sanitizedKey = sanitizeRedisKey(key);
        
        const checkClient = client.isOpen ? client : redis.createClient({
            socket: {
                host: process.env.REDIS_HOST || '172.33.0.107',
                port: process.env.REDIS_PORT || 6379,
                connectTimeout: 5000,
                commandTimeout: 5000
            },
            password: process.env.REDIS_PASSWORD || undefined,
            database: process.env.REDIS_DB || 0,
        });
        
        if (!checkClient.isOpen) {
            await checkClient.connect();
        }

        // Check if key exists before deleting
        const exists = await checkClient.exists(sanitizedKey);
        
        if (!exists) {
            if (checkClient !== client) {
                await checkClient.quit();
            }
            
            return res.status(404).json({
                status: 'Error',
                message: `Key '${sanitizedKey}' not found in Redis cache`
            });
        }
        
        // Delete the key
        await checkClient.del(sanitizedKey);
        
        // Only disconnect if we created a new client
        if (checkClient !== client) {
            await checkClient.quit();
        }
        
        res.status(200).json({
            status: 'OK',
            message: `Successfully deleted key '${key}' from Redis cache`
        });
        
    } catch (error) {
        logger.error(`Redis cache key deletion failed: ${error.message}`);
        res.status(503).json({
            status: 'Error',
            message: `Failed to delete Redis cache key: ${error.message}`,
            details: {
                key,
                host: process.env.REDIS_HOST || '172.33.0.107',
                port: process.env.REDIS_PORT || 6379
            }
        });
    }
};

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

module.exports = {
    getRedisStatus,
    getKafkaStatus,
    getAllCacheKeys,
    deleteCacheKey
};
