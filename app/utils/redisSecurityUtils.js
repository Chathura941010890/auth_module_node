// Redis Security Utilities
// This file contains utility functions to prevent NoSQL injection attacks in Redis operations

/**
 * Sanitizes a Redis cache key to prevent NoSQL injection attacks
 * @param {string|number} key - The key to sanitize
 * @returns {string} - Sanitized key safe for Redis operations
 * @throws {Error} - If key is invalid type or empty after sanitization
 */
const sanitizeRedisKey = (key) => {
  if (typeof key !== 'string' && typeof key !== 'number') {
    throw new Error('Invalid Redis key type - must be string or number');
  }
  
  // Convert to string and sanitize
  const sanitized = String(key)
    .replace(/[^a-zA-Z0-9:_\-\.@]/g, '_') // Replace invalid characters with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .substring(0, 250); // Limit key length (Redis max is 512MB but keep reasonable)
  
  if (sanitized.length === 0) {
    throw new Error('Redis key cannot be empty after sanitization');
  }
  
  return sanitized;
};

/**
 * Builds a safe cache key from multiple parts
 * @param {...(string|number)} parts - Parts to join with ':'
 * @returns {string} - Safe Redis key
 */
const buildSafeRedisKey = (...parts) => {
  if (parts.length === 0) {
    throw new Error('At least one key part is required');
  }
  
  return parts.map(part => sanitizeRedisKey(part)).join(':');
};

/**
 * Validates pagination parameters and returns safe values
 * @param {*} page - Page number (potentially unsafe user input)
 * @param {*} pageSize - Page size (potentially unsafe user input)
 * @param {number} maxPageSize - Maximum allowed page size (default: 100)
 * @returns {object} - {safePage: number, safePageSize: number}
 */
const sanitizePaginationParams = (page, pageSize, maxPageSize = 100000) => {
  const safePage = Math.max(1, parseInt(page) || 1);
  const safePageSize = Math.min(Math.max(1, parseInt(pageSize) || 10), maxPageSize);
  
  return { safePage, safePageSize };
};

/**
 * Sanitizes a string input for use in Redis patterns (for SCAN operations)
 * More restrictive than regular key sanitization
 * @param {string} pattern - Pattern to sanitize
 * @returns {string} - Safe pattern
 */
const sanitizeRedisPattern = (pattern) => {
  if (typeof pattern !== 'string') {
    throw new Error('Redis pattern must be a string');
  }
  
  // Allow only alphanumeric, colons, underscores, hyphens, dots, and asterisks
  const sanitized = pattern.replace(/[^a-zA-Z0-9:_\-\.\*]/g, '_');
  
  if (sanitized.length === 0) {
    throw new Error('Redis pattern cannot be empty after sanitization');
  }
  
  return sanitized;
};

module.exports = {
  sanitizeRedisKey,
  buildSafeRedisKey,
  sanitizePaginationParams,
  sanitizeRedisPattern
};