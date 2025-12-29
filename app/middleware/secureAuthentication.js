/**
 * Secure Authentication Middleware
 * Implements comprehensive security controls for JWT authentication
 */

const jwt = require("jsonwebtoken");
const AppError = require('../utils/appError');
const { safeHeaderJsonParse } = require('../utils/jsonSecurityUtils');
const { 
  verifyToken, 
  checkAccountLockout, 
  recordFailedLogin,
  SECURITY_CONFIG 
} = require('../utils/authSecurityUtils');

/**
 * Get client IP address with proper header handling
 */
const getClientIp = async (req) => {    
  return ( req.headers['x-original-ip'] || 'unknown' );
};

/**
 * Extract and validate JWT token from request headers
 */
const extractToken = (req) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    throw new AppError('Authorization header is required', 401);
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    throw new AppError('Authorization header must start with "Bearer "', 401);
  }
  
  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
  
  if (!token || token.length === 0) {
    throw new AppError('Access token is required', 401);
  }
  
  // Basic token format validation
  if (token.length > 2048) { // Reasonable JWT length limit
    throw new AppError('Access token is too long', 401);
  }
  
  // Check for basic JWT structure (header.payload.signature)
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AppError('Invalid token format', 401);
  }
  
  return token;
};

/**
 * Enhanced JWT authentication middleware with security controls
 */
const authenticateToken = async (req, res, next) => {
  const clientIp = await getClientIp(req);
  
  try {
    // Extract and validate token
    const token = extractToken(req);
    
    // Get JWT secret with validation
    const jwtSecret = process.env.JWT_SECRET_KEY;
    if (!jwtSecret || jwtSecret.length < 32) {
      console.error('SECURITY WARNING: JWT secret is missing or too weak');
      throw new AppError('Authentication service configuration error', 500);
    }
    
    // Verify and decode token
    const decoded = verifyToken(token, jwtSecret, 'access');
    
    // Check account lockout status
    if (decoded.userId) {
      checkAccountLockout(decoded.userId);
    }
    
    // Additional security checks
    if (!decoded.userId || !decoded.email) {
      throw new AppError('Invalid token payload - missing required fields', 401);
    }
    
    // Validate token age (additional security)
    const tokenAge = Date.now() / 1000 - decoded.iat;
    const maxAge = 24 * 60 * 60; // 24 hours max token age
    if (tokenAge > maxAge) {
      throw new AppError('Token is too old', 401);
    }
    
    // Set user information in request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      tokenId: decoded.tokenId,
      iat: decoded.iat
    };
    
    // Add client IP for logging
    req.clientIp = clientIp;
    
    next();
    
  } catch (error) {
    // Record failed authentication for monitoring
    if (req.user?.userId) {
      recordFailedLogin(req.user.userId);
    }
    
    // Log security event
    console.warn(`Authentication failed from IP ${clientIp}: ${error.message}`);
    
    // Return appropriate error
    if (error instanceof AppError) {
      return next(error);
    }
    
    // Handle specific JWT errors
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid access token', 401));
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Access token has expired', 401));
    }
    
    // Generic authentication error
    next(new AppError('Authentication failed', 401));
  }
};

/**
 * Optional authentication middleware (doesn't throw errors)
 */
const authenticateTokenOptional = async (req, res, next) => {
  const clientIp = await getClientIp(req);
  
  try {
    // Only proceed if authorization header exists
    if (!req.headers['authorization']) {
      req.clientIp = clientIp;
      return next();
    }
    
    const token = extractToken(req);
    const jwtSecret = process.env.JWT_SECRET_KEY;
    
    if (jwtSecret && jwtSecret.length >= 32) {
      const decoded = verifyToken(token, jwtSecret, 'access');
      
      if (decoded.userId) {
        // Don't throw on lockout for optional auth
        try {
          checkAccountLockout(decoded.userId);
          req.user = {
            userId: decoded.userId,
            email: decoded.email,
            tokenId: decoded.tokenId,
            iat: decoded.iat
          };
        } catch (lockoutError) {
          // Silently ignore lockout for optional auth
        }
      }
    }
    
    req.clientIp = clientIp;
    next();
    
  } catch (error) {
    // For optional auth, continue without user context
    req.clientIp = clientIp;
    next();
  }
};

/**
 * Middleware to validate refresh tokens
 */
const authenticateRefreshToken = async (req, res, next) => {
  const clientIp = await getClientIp(req);
  
  try {
    const token = extractToken(req);
    const jwtSecret = process.env.JWT_SECRET_KEY;
    
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new AppError('Authentication service configuration error', 500);
    }
    
    // Verify as refresh token
    const decoded = verifyToken(token, jwtSecret, 'refresh');
    
    // Check account lockout
    if (decoded.userId) {
      checkAccountLockout(decoded.userId);
    }
    
    req.user = {
      userId: decoded.userId,
      tokenId: decoded.tokenId,
      iat: decoded.iat
    };
    
    req.clientIp = clientIp;
    next();
    
  } catch (error) {
    console.warn(`Refresh token validation failed from IP ${clientIp}: ${error.message}`);
    
    if (error instanceof AppError) {
      return next(error);
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid refresh token', 401));
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Refresh token has expired', 401));
    }
    
    next(new AppError('Refresh token validation failed', 401));
  }
};

/**
 * Enhanced API key validation with security controls
 */
const validateApiKey = async (req, res, next) => {
  const clientIp = await getClientIp(req);
  
  try {
    // Skip health check and other public endpoints
    const publicPaths = [
      '/healthCheck',
      '/auth/api/v1/healthCheck',
      '/auth/api/v1/signin',
      '/auth/api/v1/signup',
      '/auth/api/v1/password-reset-request'
    ];
    
    if (publicPaths.some(path => req.path === path || req.path.includes(path))) {
      req.clientIp = clientIp;
      return next();
    }

    if (!req.headers['x-api-key']) {
      throw new AppError('API key is required', 403);
    }

    const { callDecrypt } = require('../utils/AESEncrypt');
    
    // Safely parse the JSON header to prevent injection
    const apiKeyData = safeHeaderJsonParse(req.headers['x-api-key'], {
      maxLength: 500,
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
    
    // Additional security: check for suspicious patterns
    if (key.includes('<script>') || code.includes('<script>') || 
        key.includes('javascript:') || code.includes('javascript:')) {
      throw new AppError('Invalid API key format - contains forbidden patterns', 403);
    }
    
    const decryptValue = await callDecrypt(key, code.toString());
      
    if (decryptValue !== "success") {
      throw new AppError('Invalid API key', 403);
    }

    req.clientIp = clientIp;
    next();
    
  } catch (error) {
    console.warn(`API key validation failed from IP ${clientIp}: ${error.message}`);
    
    if (error instanceof AppError) {
      next(error);
    } else {
      // Log the actual error for debugging but don't expose details
      console.error('API key validation error:', error.message);
      next(new AppError('API key validation failed', 403));
    }
  }
};

/**
 * Middleware to require specific user roles or permissions
 */
const requireRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        throw new AppError('Authentication required', 401);
      }
      
      // If no roles specified, just require authentication
      if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        return next();
      }
      
      // TODO: Implement role checking logic based on your role system
      // This would typically query the database for user roles
      // For now, we'll just continue
      next();
      
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Security headers middleware
 */
const setSecurityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Enforce HTTPS (in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (basic)
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
  
  next();
};

module.exports = {
  authenticateToken,
  authenticateTokenOptional,
  authenticateRefreshToken,
  validateApiKey,
  requireRole,
  setSecurityHeaders,
  getClientIp
};