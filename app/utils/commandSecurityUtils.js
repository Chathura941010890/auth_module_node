// Command Injection Prevention Utilities
// This file contains utilities to prevent command injection attacks

const validator = require('validator');

/**
 * Sanitizes and validates environment variable names
 * @param {string} envName - Environment variable name to validate
 * @returns {boolean} - Whether the env name is safe
 */
const isValidEnvName = (envName) => {
  if (typeof envName !== 'string') return false;
  
  // Allow only alphanumeric characters and underscores
  const validPattern = /^[A-Z][A-Z0-9_]*$/;
  return validPattern.test(envName) && envName.length <= 100;
};

/**
 * Safely retrieves environment variable with validation
 * @param {string} envName - Environment variable name
 * @param {string} defaultValue - Default value if env var not found
 * @param {object} options - Validation options
 * @returns {string} - Safe environment variable value
 */
const safeGetEnv = (envName, defaultValue = '', options = {}) => {
  const {
    allowEmpty = false,
    maxLength = 1000,
    pattern = null,
    isNumeric = false,
    isPort = false,
    isHost = false
  } = options;

  if (!isValidEnvName(envName)) {
    console.warn(`Invalid environment variable name: ${envName}`);
    return defaultValue;
  }

  const value = process.env[envName];
  
  if (!value) {
    return defaultValue;
  }

  // Length validation
  if (value.length > maxLength) {
    console.warn(`Environment variable ${envName} exceeds maximum length`);
    return defaultValue;
  }

  // Empty value check
  if (!allowEmpty && value.trim().length === 0) {
    return defaultValue;
  }

  // Type-specific validations
  if (isNumeric && !validator.isNumeric(value)) {
    console.warn(`Environment variable ${envName} is not numeric`);
    return defaultValue;
  }

  if (isPort && (!validator.isPort(value))) {
    console.warn(`Environment variable ${envName} is not a valid port`);
    return defaultValue;
  }

  if (isHost && (!validator.isFQDN(value) && !validator.isIP(value) && value !== 'localhost')) {
    console.warn(`Environment variable ${envName} is not a valid host`);
    return defaultValue;
  }

  // Pattern validation
  if (pattern && !pattern.test(value)) {
    console.warn(`Environment variable ${envName} does not match required pattern`);
    return defaultValue;
  }

  // Check for potential command injection patterns
  const dangerousPatterns = [
    /[;&|`$(){}]/g,    // Shell metacharacters
    /\.\./g,           // Directory traversal
    /\/etc\/|\/bin\/|\/usr\/|\/var\//g, // System directories
    /cmd|powershell|bash|sh|exec/gi     // Command execution keywords
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(value)) {
      console.warn(`Environment variable ${envName} contains dangerous patterns`);
      return defaultValue;
    }
  }

  return value.trim();
};

/**
 * Validates and sanitizes file paths to prevent path traversal
 * @param {string} filePath - File path to validate
 * @param {string} allowedDirectory - Base directory that files must be within
 * @returns {string|null} - Sanitized path or null if invalid
 */
const sanitizeFilePath = (filePath, allowedDirectory = process.cwd()) => {
  if (typeof filePath !== 'string') {
    return null;
  }

  const path = require('path');
  
  try {
    // Normalize the path to resolve .. and . 
    const normalizedPath = path.normalize(filePath);
    
    // Get absolute path
    const absolutePath = path.resolve(allowedDirectory, normalizedPath);
    
    // Ensure the resolved path is within the allowed directory
    if (!absolutePath.startsWith(path.resolve(allowedDirectory))) {
      console.warn(`Path traversal attempt blocked: ${filePath}`);
      return null;
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /\.\./g,                    // Directory traversal
      /\/etc\/|\/bin\/|\/usr\/|\/var\//g, // System directories (Unix)
      /C:\\Windows\\|C:\\Program Files/gi, // System directories (Windows)
      /[<>"|*?]/g,               // Invalid filename characters
      /[\x00-\x1F]/g             // Control characters
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(normalizedPath)) {
        console.warn(`Dangerous file path pattern detected: ${filePath}`);
        return null;
      }
    }

    return absolutePath;
  } catch (error) {
    console.warn(`File path validation error: ${error.message}`);
    return null;
  }
};

/**
 * Sanitizes log messages to prevent log injection
 * @param {string} message - Log message to sanitize
 * @returns {string} - Sanitized log message
 */
const sanitizeLogMessage = (message) => {
  if (typeof message !== 'string') {
    return String(message);
  }

  return message
    .replace(/[\r\n]/g, ' ')      // Remove line breaks
    .replace(/\t/g, ' ')          // Replace tabs with spaces
    .replace(/[^\x20-\x7E]/g, '') // Remove non-printable characters
    .substring(0, 1000);          // Limit length
};

/**
 * Validates URL to prevent SSRF attacks
 * @param {string} url - URL to validate
 * @param {object} options - Validation options
 * @returns {boolean} - Whether URL is safe
 */
const isValidUrl = (url, options = {}) => {
  const {
    allowedProtocols = ['http:', 'https:'],
    allowLocalhost = false,
    allowPrivateIPs = false
  } = options;

  try {
    const urlObj = new URL(url);
    
    // Protocol validation
    if (!allowedProtocols.includes(urlObj.protocol)) {
      return false;
    }

    // Localhost validation
    if (!allowLocalhost && (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1')) {
      return false;
    }

    // Private IP validation
    if (!allowPrivateIPs) {
      const privateIPPatterns = [
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^127\./,
        /^169\.254\./
      ];

      for (const pattern of privateIPPatterns) {
        if (pattern.test(urlObj.hostname)) {
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Safely formats template strings to prevent injection
 * @param {string} template - Template string
 * @param {object} variables - Variables to substitute
 * @returns {string} - Safely formatted string
 */
const safeTemplate = (template, variables = {}) => {
  if (typeof template !== 'string') {
    return '';
  }

  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    if (typeof key !== 'string' || key.length === 0) {
      continue;
    }

    // Sanitize the key to prevent injection
    const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
    if (safeKey !== key) {
      console.warn(`Template key sanitized: ${key} -> ${safeKey}`);
    }

    // Sanitize the value
    let safeValue = '';
    if (value !== null && value !== undefined) {
      safeValue = String(value)
        .replace(/[<>&"']/g, (char) => {
          const entities = {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#x27;'
          };
          return entities[char] || char;
        });
    }

    // Replace placeholder with safe value
    const placeholder = new RegExp(`\\$\\{${safeKey}\\}`, 'g');
    result = result.replace(placeholder, safeValue);
  }

  return result;
};

module.exports = {
  isValidEnvName,
  safeGetEnv,
  sanitizeFilePath,
  sanitizeLogMessage,
  isValidUrl,
  safeTemplate
};