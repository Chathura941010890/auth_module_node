// JSON Security Utilities
// This file contains utility functions to prevent JSON injection attacks

/**
 * Safely parses JSON with input validation and error handling
 * @param {string} jsonString - The JSON string to parse
 * @param {object} options - Configuration options
 * @param {number} options.maxLength - Maximum allowed string length (default: 10000)
 * @param {boolean} options.allowNulls - Whether to allow null values (default: true)
 * @param {boolean} options.strict - Whether to use strict parsing (default: true)
 * @returns {object|null} - Parsed JSON object or null on error
 * @throws {Error} - If validation fails
 */
const safeJsonParse = (jsonString, options = {}) => {
  const {
    maxLength = 10000,
    allowNulls = true,
    strict = true
  } = options;

  // Type validation
  if (typeof jsonString !== 'string') {
    throw new Error('JSON input must be a string');
  }

  // Length validation
  if (jsonString.length > maxLength) {
    throw new Error(`JSON string exceeds maximum length of ${maxLength} characters`);
  }

  // Empty string check
  if (jsonString.trim().length === 0) {
    if (allowNulls) return null;
    throw new Error('JSON string cannot be empty');
  }

  // Check for potentially dangerous patterns
  if (strict) {
    // Prevent prototype pollution attempts
    const dangerousPatterns = [
      /__proto__/gi,
      /constructor/gi,
      /prototype/gi,
      /function/gi,
      /eval/gi,
      /script/gi,
      /javascript:/gi,
      /on\w+=/gi // Event handlers like onclick=
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(jsonString)) {
        throw new Error('JSON contains potentially dangerous patterns');
      }
    }
  }

  try {
    const parsed = JSON.parse(jsonString);
    
    // Additional validation for parsed object
    if (parsed && typeof parsed === 'object') {
      validateObjectSafety(parsed, strict);
    }

    return parsed;
  } catch (error) {
    if (error.message.includes('dangerous patterns') || error.message.includes('unsafe')) {
      throw error; // Re-throw security-related errors
    }
    throw new Error(`Invalid JSON format: ${error.message}`);
  }
};

/**
 * Recursively validates object safety to prevent prototype pollution
 * @param {object} obj - Object to validate
 * @param {boolean} strict - Whether to use strict validation
 */
const validateObjectSafety = (obj, strict = true) => {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      // Check for dangerous property names
      if (dangerousKeys.includes(key.toLowerCase())) {
        throw new Error(`Unsafe property name detected: ${key}`);
      }

      // Check for dangerous property values
      if (strict && typeof obj[key] === 'string') {
        const dangerousValue = /function\s*\(|eval\s*\(|javascript:|<script/gi;
        if (dangerousValue.test(obj[key])) {
          throw new Error(`Unsafe property value detected: ${key}`);
        }
      }

      // Recursively validate nested objects
      if (typeof obj[key] === 'object') {
        validateObjectSafety(obj[key], strict);
      }
    }
  }
};

/**
 * Safely stringifies JSON with protection against circular references
 * @param {any} obj - Object to stringify
 * @param {object} options - Configuration options
 * @param {number} options.maxDepth - Maximum nesting depth (default: 10)
 * @param {number} options.maxLength - Maximum result length (default: 100000)
 * @returns {string} - Safe JSON string
 */
const safeJsonStringify = (obj, options = {}) => {
  const {
    maxDepth = 10,
    maxLength = 100000
  } = options;

  const seen = new WeakSet();
  let depth = 0;

  const replacer = (key, value) => {
    depth++;
    
    if (depth > maxDepth) {
      return '[Max Depth Exceeded]';
    }

    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }

    // Filter out potentially dangerous functions
    if (typeof value === 'function') {
      return '[Function]';
    }

    depth--;
    return value;
  };

  try {
    const result = JSON.stringify(obj, replacer);
    
    if (result.length > maxLength) {
      throw new Error(`Stringified JSON exceeds maximum length of ${maxLength} characters`);
    }

    return result;
  } catch (error) {
    throw new Error(`JSON stringify failed: ${error.message}`);
  }
};

/**
 * Safely parses Base64-encoded JSON
 * @param {string} base64String - Base64-encoded JSON string
 * @param {object} options - Options for safeJsonParse
 * @returns {object|null} - Parsed object or null
 */
const safeBase64JsonParse = (base64String, options = {}) => {
  if (typeof base64String !== 'string') {
    throw new Error('Base64 input must be a string');
  }

  // Validate Base64 format
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64String)) {
    throw new Error('Invalid Base64 format');
  }

  try {
    const decoded = Buffer.from(base64String, 'base64').toString('utf8');
    return safeJsonParse(decoded, options);
  } catch (error) {
    throw new Error(`Base64 JSON parse failed: ${error.message}`);
  }
};

/**
 * Validates and sanitizes JSON from HTTP headers
 * @param {string} headerValue - JSON string from HTTP header
 * @param {object} options - Configuration options
 * @returns {object} - Parsed and validated object
 */
const safeHeaderJsonParse = (headerValue, options = {}) => {
  const defaultOptions = {
    maxLength: 2000, // Headers should be smaller
    strict: true,
    allowNulls: false
  };

  const mergedOptions = { ...defaultOptions, ...options };
  return safeJsonParse(headerValue, mergedOptions);
};

module.exports = {
  safeJsonParse,
  safeJsonStringify,
  safeBase64JsonParse,
  safeHeaderJsonParse,
  validateObjectSafety
};