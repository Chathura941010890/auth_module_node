const jwt = require("jsonwebtoken");
const AppError = require('../utils/appError');
const { safeHeaderJsonParse } = require('../utils/jsonSecurityUtils');

/**
 * Middleware to authenticate JWT tokens
 */
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new AppError('Access token is required', 401);
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
      if (err) {
        throw new AppError('Invalid or expired token', 403);
      }
      req.user = user;
      next();
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware for token validation only (no error throwing)
 */
const authenticateTokenOnly = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (!err) {
          req.user = user;
        }
      });
    }
    next();
  } catch (error) {
    next();
  }
};

/**
 * Middleware to validate API keys
 */
const validateApiKey = async (req, res, next) => {
  try {
    // Skip health check and other public endpoints
    if (req.path === '/healthCheck' || req.path.includes('/auth/api/v1/healthCheck')) {
      return next();
    }

    if (!req.headers['x-api-key']) {
      throw new AppError('API key is required', 403);
    }

    const { callDecrypt } = require('../utils/AESEncrypt');
    
    // Safely parse the JSON header to prevent injection
    const apiKeyData = safeHeaderJsonParse(req.headers['x-api-key'], {
      maxLength: 500, // Reasonable limit for API key
      strict: true
    });
    
    const { key, code } = apiKeyData;
    
    // Validate required fields
    if (!key || !code) {
      throw new AppError('Invalid API key format - missing key or code', 403);
    }
    
    // Validate key and code are strings and reasonable length
    if (typeof key !== 'string' || typeof code !== 'string') {
      throw new AppError('Invalid API key format - key and code must be strings', 403);
    }
    
    if (key.length > 200 || code.toString().length > 200) {
      throw new AppError('Invalid API key format - key or code too long', 403);
    }
    
    const decryptValue = await callDecrypt(key, code.toString());
      
    if (decryptValue !== "success") {
      throw new AppError('Invalid API key', 403);
    }

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      // Log the actual error for debugging but don't expose details
      console.error('API key validation error:', error.message);
      next(new AppError('API key validation failed', 403));
    }
  }
};

module.exports = {
  authenticateToken,
  authenticateTokenOnly,
  validateApiKey
};
