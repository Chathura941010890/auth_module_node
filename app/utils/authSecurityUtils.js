/**
 * Authentication Security Utilities
 * Provides comprehensive security controls for authentication and session management
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AppError = require('./appError');
const { client: redis } = require('../database/redisClient');
const logger = require('./logger');

// Constants for security policies
const SECURITY_CONFIG = {
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true,
    SPECIAL_CHARS: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    HISTORY_COUNT: 5, // Remember last 5 passwords
    MAX_AGE_DAYS: 90 // Force change every 90 days
  },
  ACCOUNT_LOCKOUT: {
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION_MINUTES: 30,
    ESCALATION_ATTEMPTS: 10, // Extended lockout after 10 failures
    EXTENDED_LOCKOUT_HOURS: 24
  },
  RATE_LIMITING: {
    LOGIN_ATTEMPTS_PER_IP: 10,
    LOGIN_WINDOW_MINUTES: 15,
    PASSWORD_RESET_PER_IP: 3,
    PASSWORD_RESET_WINDOW_HOURS: 1
  },
  JWT: {
    ACCESS_TOKEN_EXPIRY: process.env.NODE_ENV === 'production' ? '15m' : '600m', // Short-lived access tokens
    REFRESH_TOKEN_EXPIRY: '1d', // Refresh tokens
    RESET_TOKEN_EXPIRY: '1h', // Password reset tokens
    MAX_CONCURRENT_SESSIONS: 3
  },
  REDIS: {
    KEY_PREFIX: 'auth:', // Prefix for all auth-related Redis keys
    LOGIN_ATTEMPTS_KEY: 'loginAttempts:', // IP -> { count, firstAttempt, blocked }
    USER_LOCKOUT_KEY: 'userLockout:', // userId -> { attempts, lockedUntil, escalated }
    ACTIVE_TOKENS_KEY: 'activeTokens:', // userId -> Set of tokenIds
    REVOKED_TOKENS_KEY: 'revokedTokens', // Set of revoked token IDs
    PASSWORD_RESET_KEY: 'passwordReset:' // IP -> { count, firstAttempt }
  }
};

/**
 * Validate password strength according to security policy
 */
const validatePasswordStrength = (password) => {
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    throw new AppError('Password is required and must be a string', 400);
  }
  
  if (password.length < SECURITY_CONFIG.PASSWORD.MIN_LENGTH) {
    errors.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD.MIN_LENGTH} characters long`);
  }
  
  if (password.length > SECURITY_CONFIG.PASSWORD.MAX_LENGTH) {
    errors.push(`Password must not exceed ${SECURITY_CONFIG.PASSWORD.MAX_LENGTH} characters`);
  }
  
  if (SECURITY_CONFIG.PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (SECURITY_CONFIG.PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (SECURITY_CONFIG.PASSWORD.REQUIRE_NUMBERS && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (SECURITY_CONFIG.PASSWORD.REQUIRE_SPECIAL_CHARS) {
    const specialChars = SECURITY_CONFIG.PASSWORD.SPECIAL_CHARS;
    const hasSpecialChar = specialChars.split('').some(char => password.includes(char));
    if (!hasSpecialChar) {
      errors.push(`Password must contain at least one special character: ${specialChars}`);
    }
  }
  
  // Check for common weak patterns
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password cannot contain more than 2 consecutive identical characters');
  }
  
  if (/123|abc|qwe|password|admin/i.test(password)) {
    errors.push('Password cannot contain common patterns or dictionary words');
  }
  
  if (errors.length > 0) {
    throw new AppError(`Password validation failed: ${errors.join(', ')}`, 400);
  }
  
  return true;
};

/**
 * Check if password was used recently (password history)
 */
const checkPasswordHistory = async (userId, newPassword, previousPasswords = []) => {
  if (!Array.isArray(previousPasswords)) {
    return true; // Skip check if no history available
  }
  
  for (const oldPassword of previousPasswords.slice(0, SECURITY_CONFIG.PASSWORD.HISTORY_COUNT)) {
    if (await bcrypt.compare(newPassword, oldPassword)) {
      throw new AppError(
        `Password cannot be one of your last ${SECURITY_CONFIG.PASSWORD.HISTORY_COUNT} passwords`, 
        400
      );
    }
  }
  
  return true;
};

/**
 * Redis helper for login attempts
 */
const getLoginAttemptKey = (clientIp) => `${SECURITY_CONFIG.REDIS.KEY_PREFIX}${SECURITY_CONFIG.REDIS.LOGIN_ATTEMPTS_KEY}${clientIp}`;

/**
 * Get login attempt data from Redis
 */
const getLoginAttempt = async (clientIp) => {
  try {
    const data = await redis.get(getLoginAttemptKey(clientIp));
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Redis error getting login attempt:', error);
    return null;
  }
};

/**
 * Save login attempt data to Redis
 */
const saveLoginAttempt = async (clientIp, data, expirySeconds) => {
  try {
    const key = getLoginAttemptKey(clientIp);
    await redis.set(key, JSON.stringify(data), {
      EX: expirySeconds
    });
    return true;
  } catch (error) {
    logger.error('Redis error saving login attempt:', error);
    return false;
  }
};

/**
 * Delete login attempt data from Redis
 */
const deleteLoginAttempt = async (clientIp) => {
  try {
    await redis.del(getLoginAttemptKey(clientIp));
    return true;
  } catch (error) {
    logger.error('Redis error deleting login attempt:', error);
    return false;
  }
};

/**
 * Check rate limiting for login attempts by IP
 */
const checkLoginRateLimit = async (clientIp) => {
  const now = Date.now();
  const windowMs = SECURITY_CONFIG.RATE_LIMITING.LOGIN_WINDOW_MINUTES * 60 * 1000;
  
  if (!clientIp || typeof clientIp !== 'string') {
    throw new Error('Invalid client IP address', 400);
  }
  
  const attempts = await getLoginAttempt(clientIp);
  
  if (attempts) {
    // Reset window if expired
    if (now - attempts.firstAttempt > windowMs) {
      await deleteLoginAttempt(clientIp);
      return true;
    }
    
    // Check if blocked
    if (attempts.blocked && now < attempts.blockedUntil) {
      const remainingTime = Math.ceil((attempts.blockedUntil - now) / 60000);
      throw new Error(`Too many login attempts. Try again in ${remainingTime} minutes`, 429);
    }
    
    // Check if limit exceeded
    if (attempts.count >= SECURITY_CONFIG.RATE_LIMITING.LOGIN_ATTEMPTS_PER_IP) {
      const blockDuration = 30 * 60 * 1000; // 30 minutes
      attempts.blocked = true;
      attempts.blockedUntil = now + blockDuration;
      
      // Save updated attempt data with longer expiry (block duration)
      await saveLoginAttempt(clientIp, attempts, Math.ceil(blockDuration / 1000));
      
      throw new Error('Too many login attempts. Account temporarily blocked', 429);
    }
  }
  
  return true;
};

/**
 * Record login attempt
 */
const recordLoginAttempt = async (clientIp, success = false) => {
  if (!clientIp || typeof clientIp !== 'string') {
    return;
  }
  
  const now = Date.now();
  const windowMs = SECURITY_CONFIG.RATE_LIMITING.LOGIN_WINDOW_MINUTES * 60 * 1000;
  const windowSeconds = Math.ceil(windowMs / 1000);
  
  if (success) {
    // Clear attempts on successful login
    await deleteLoginAttempt(clientIp);
    return;
  }
  
  // Get current attempts or initialize new record
  const attempts = await getLoginAttempt(clientIp) || { count: 0, firstAttempt: now };
  
  // Reset if window expired
  if (now - attempts.firstAttempt > windowMs) {
    attempts.count = 1;
    attempts.firstAttempt = now;
  } else {
    attempts.count++;
  }
  
  // Save to Redis with expiration
  await saveLoginAttempt(clientIp, attempts, windowSeconds);
};

/**
 * Redis helper for user lockouts
 */
const getUserLockoutKey = (userId) => `${SECURITY_CONFIG.REDIS.KEY_PREFIX}${SECURITY_CONFIG.REDIS.USER_LOCKOUT_KEY}${userId}`;

/**
 * Get user lockout data from Redis
 */
const getUserLockout = async (userId) => {
  try {
    const data = await redis.get(getUserLockoutKey(userId));
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Redis error getting user lockout:', error);
    return null;
  }
};

/**
 * Save user lockout data to Redis
 */
const saveUserLockout = async (userId, data, expirySeconds = null) => {
  try {
    const key = getUserLockoutKey(userId);
    if (expirySeconds) {
      await redis.set(key, JSON.stringify(data), {
        EX: expirySeconds
      });
    } else {
      await redis.set(key, JSON.stringify(data));
    }
    return true;
  } catch (error) {
    logger.error('Redis error saving user lockout:', error);
    return false;
  }
};

/**
 * Delete user lockout data from Redis
 */
const deleteUserLockout = async (userId) => {
  try {
    await redis.del(getUserLockoutKey(userId));
    return true;
  } catch (error) {
    logger.error('Redis error deleting user lockout:', error);
    return false;
  }
};

/**
 * Check account lockout status
 */
const checkAccountLockout = async (userId) => {
  if (!userId) {
    throw new AppError('User ID is required', 400);
  }
  
  const lockout = await getUserLockout(userId);
  if (!lockout) {
    return true;
  }
  
  const now = Date.now();
  
  // Check if lockout period has expired
  if (lockout.lockedUntil && now < lockout.lockedUntil) {
    const remainingTime = Math.ceil((lockout.lockedUntil - now) / 60000);
    throw new AppError(`Account is locked. Try again in ${remainingTime} minutes`, 423);
  }
  
  // Clear expired lockout
  if (lockout.lockedUntil && now >= lockout.lockedUntil) {
    await deleteUserLockout(userId);
  }
  
  return true;
};

/**
 * Record failed login attempt for user
 */
const recordFailedLogin = async (userId) => {
  if (!userId) {
    return;
  }
  
  const now = Date.now();
  const lockout = await getUserLockout(userId) || { attempts: 0, escalated: false };
  
  lockout.attempts++;
  
  let expirySeconds = null;
  
  // First lockout - 30 minutes
  if (lockout.attempts >= SECURITY_CONFIG.ACCOUNT_LOCKOUT.MAX_FAILED_ATTEMPTS && !lockout.escalated) {
    const lockoutMs = SECURITY_CONFIG.ACCOUNT_LOCKOUT.LOCKOUT_DURATION_MINUTES * 60 * 1000;
    lockout.lockedUntil = now + lockoutMs;
    expirySeconds = Math.ceil(lockoutMs / 1000);
  }
  
  // Extended lockout - 24 hours
  if (lockout.attempts >= SECURITY_CONFIG.ACCOUNT_LOCKOUT.ESCALATION_ATTEMPTS) {
    const extendedLockoutMs = SECURITY_CONFIG.ACCOUNT_LOCKOUT.EXTENDED_LOCKOUT_HOURS * 60 * 60 * 1000;
    lockout.lockedUntil = now + extendedLockoutMs;
    lockout.escalated = true;
    expirySeconds = Math.ceil(extendedLockoutMs / 1000);
  }
  
  await saveUserLockout(userId, lockout, expirySeconds);
};

/**
 * Clear failed login attempts for user (on successful login)
 */
const clearFailedLogins = async (userId) => {
  if (userId) {
    await deleteUserLockout(userId);
  }
};

/**
 * Redis helper for active tokens
 */
const getActiveTokensKey = (userId) => `${SECURITY_CONFIG.REDIS.KEY_PREFIX}${SECURITY_CONFIG.REDIS.ACTIVE_TOKENS_KEY}${userId}`;

/**
 * Redis helper for revoked tokens
 */
const getRevokedTokensKey = () => `${SECURITY_CONFIG.REDIS.KEY_PREFIX}${SECURITY_CONFIG.REDIS.REVOKED_TOKENS_KEY}`;

/**
 * Add token to user's active tokens set
 */

const addActiveToken = async (userId, tokenId) => {
  try {
    const now = Date.now();
    await redis.zAdd(getActiveTokensKey(userId), [{ score: now, value: tokenId }]);
    return true;
  } catch (error) {
    logger.error('Redis error adding active token:', error);
    return false;
  }
};

/**
 * Get all active tokens for a user
 */

const getActiveTokens = async (userId) => {
  try {
    // 0 = oldest, -1 = newest
    return await redis.zRange(getActiveTokensKey(userId), 0, -1);
  } catch (error) {
    logger.error('Redis error getting active tokens:', error);
    return [];
  }
};

/**
 * Remove token from user's active tokens
 */

const removeActiveToken = async (userId, tokenId) => {
  try {
    await redis.zRem(getActiveTokensKey(userId), tokenId);
    return true;
  } catch (error) {
    logger.error('Redis error removing active token:', error);
    return false;
  }
};

/**
 * Mark token as revoked
 */
const addRevokedToken = async (tokenId) => {
  try {
    
    await redis.sAdd(getRevokedTokensKey(), tokenId);
    return true;
  } catch (error) {
    logger.error('Redis error adding revoked token:', error);
    return false;
  }
};

/**
 * Check if token is revoked
 */
const isTokenRevoked = async (tokenId) => {
  try {
    
    return await redis.sIsMember(getRevokedTokensKey(), tokenId);
  } catch (error) {
    logger.error('Redis error checking revoked token:', error);
    return false;
  }
};

/**
 * Generate secure JWT tokens with proper configuration
 */
const generateTokens = async (payload, jwtSecret) => {
  if (!payload || typeof payload !== 'object') {
    throw new AppError('Invalid token payload', 400);
  }
  
  if (!jwtSecret || typeof jwtSecret !== 'string' || jwtSecret.length < 20) {
    throw new AppError('Invalid or weak JWT secret', 500);
  }
  
  const tokenId = crypto.randomUUID();
  const now = Date.now();
  
  const accessTokenPayload = {
    ...payload,
    tokenId,
    type: 'access',
    iat: Math.floor(now / 1000)
  };  
  
  const refreshTokenPayload = {
    userId: payload.userId,
    tokenId,
    type: 'refresh',
    iat: Math.floor(now / 1000)
  };  
  
  const accessToken = jwt.sign(accessTokenPayload, jwtSecret, {
    expiresIn: SECURITY_CONFIG.JWT.ACCESS_TOKEN_EXPIRY,
    issuer: 'auth-module',
    audience: 'auth-users'
  });
  
  const refreshToken = jwt.sign(refreshTokenPayload, jwtSecret, {
    expiresIn: SECURITY_CONFIG.JWT.REFRESH_TOKEN_EXPIRY,
    issuer: 'auth-module',
    audience: 'auth-users'
  });

  // Track active token in Redis (sorted set)
  await addActiveToken(payload.userId, tokenId);

  // Enforce concurrent session limit (FIFO: remove oldest tokens)
  const userTokens = await getActiveTokens(payload.userId);
    
  if (userTokens.length > SECURITY_CONFIG.JWT.MAX_CONCURRENT_SESSIONS) {
    // Remove oldest tokens (always keep the newest N)
    const tokensToRemove = userTokens.filter(item => item != tokenId) //userTokens.slice(0, userTokens.length - SECURITY_CONFIG.JWT.MAX_CONCURRENT_SESSIONS);
        
    for (const tokenAS of tokensToRemove) {
      await removeActiveToken(payload.userId, tokenAS);
      console.log("CALL TO REVOKE TOKEN IN GENERATE TOKEN");
      await addRevokedToken(tokenAS);
    }
  }

  const obj = {
    accessToken : accessToken,
    refreshToken : refreshToken,
    tokenId : tokenId,
    expiresIn: SECURITY_CONFIG.JWT.ACCESS_TOKEN_EXPIRY
  };  
  
  return obj;
};

/**
 * Verify and validate JWT token
 */
const verifyToken = async (token, jwtSecret, requiredType = 'access') => {
  if (!token || typeof token !== 'string') {
    throw new AppError('Token is required', 401);
  }  
  
  if (!jwtSecret || typeof jwtSecret !== 'string') {
    throw new AppError('JWT secret is required', 500);
  }
  
  try {
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: 'auth-module',
      audience: 'auth-users'
    });
    
    // Check token type
    if (decoded.type !== requiredType) {
      throw new AppError(`Invalid token type. Expected ${requiredType}`, 401);
    }
    
    // Check if token is revoked
    if (decoded.tokenId && await isTokenRevoked(decoded.tokenId)) {
      throw new AppError('Token has been revoked', 401);
    }
    
    // Check if user still has active tokens
    if (decoded.userId && decoded.tokenId) {
      const userTokens = await getActiveTokens(decoded.userId);
      if (!userTokens || !userTokens.includes(decoded.tokenId)) {
        throw new AppError('Token is no longer active', 401);
      }
    }
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid token', 401);
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Token has expired', 401);
    }
    throw error;
  }
};

/**
 * Revoke specific token
 */
const revokeToken = async (userId, tokenId) => {
  if (!userId || !tokenId) {
    return false;
  }
  
  try {
    const userTokens = await getActiveTokens(userId);
    if (userTokens && userTokens.includes(tokenId)) {
      await removeActiveToken(userId, tokenId);
            console.log("CALL TO REVOKE TOKEN IN REVOKE TOKEN");

      await addRevokedToken(tokenId);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Error revoking token:', error);
    return false;
  }
};

/**
 * Revoke all tokens for a user (logout from all devices)
 */
const revokeAllUserTokens = async (userId) => {
  if (!userId) {
    return 0;
  }
  
  try {
    const userTokens = await getActiveTokens(userId);
    if (!userTokens || userTokens.length === 0) {
      return 0;
    }
    
    const count = userTokens.length;
    
    // Add all tokens to revoked list
    for (const tokenId of userTokens) {
            console.log("CALL TO REVOKE TOKEN IN REVOKE ALL TOKEN");

      await addRevokedToken(tokenId);
    }
    
    // Delete all user tokens
    await redis.del(getActiveTokensKey(userId));
    
    return count;
  } catch (error) {
    logger.error('Error revoking all user tokens:', error);
    return 0;
  }
};

/**
 * Generate secure password reset token
 */
const generatePasswordResetToken = (email, jwtSecret) => {
  if (!email || typeof email !== 'string') {
    throw new AppError('Email is required for password reset', 400);
  }
  
  const payload = {
    email: email.toLowerCase().trim(),
    type: 'password_reset',
    nonce: crypto.randomBytes(16).toString('hex')
  };
  
  return jwt.sign(payload, jwtSecret, {
    expiresIn: SECURITY_CONFIG.JWT.RESET_TOKEN_EXPIRY,
    issuer: 'auth-module',
    audience: 'password-reset'
  });
};

/**
 * Verify password reset token
 */
const verifyPasswordResetToken = (token, jwtSecret) => {
  if (!token || typeof token !== 'string') {
    throw new AppError('Reset token is required', 400);
  }
  
  try {
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: 'auth-module',
      audience: 'password-reset'
    });
    
    if (decoded.type !== 'password_reset') {
      throw new AppError('Invalid reset token type', 400);
    }
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid reset token', 400);
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Reset token has expired', 400);
    }
    throw error;
  }
};

/**
 * Redis helper for password reset attempts
 */
const getPasswordResetKey = (clientIp) => `${SECURITY_CONFIG.REDIS.KEY_PREFIX}${SECURITY_CONFIG.REDIS.PASSWORD_RESET_KEY}${clientIp}`;

/**
 * Get password reset data from Redis
 */
const getPasswordResetAttempt = async (clientIp) => {
  try {
    const data = await redis.get(getPasswordResetKey(clientIp));
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Redis error getting password reset attempt:', error);
    return null;
  }
};

/**
 * Save password reset data to Redis
 */
const savePasswordResetAttempt = async (clientIp, data, expirySeconds) => {
  try {
    const key = getPasswordResetKey(clientIp);
    await redis.set(key, JSON.stringify(data), {
      EX: expirySeconds
    });
    return true;
  } catch (error) {
    logger.error('Redis error saving password reset attempt:', error);
    return false;
  }
};

/**
 * Delete password reset data from Redis
 */
const deletePasswordResetAttempt = async (clientIp) => {
  try {
    await redis.del(getPasswordResetKey(clientIp));
    return true;
  } catch (error) {
    logger.error('Redis error deleting password reset attempt:', error);
    return false;
  }
};

/**
 * Check password reset rate limiting
 */
const checkPasswordResetRateLimit = async (clientIp) => {
  if (!clientIp || typeof clientIp !== 'string') {
    throw new AppError('Invalid client IP address', 400);
  }
  
  const now = Date.now();
  const windowMs = SECURITY_CONFIG.RATE_LIMITING.PASSWORD_RESET_WINDOW_HOURS * 60 * 60 * 1000;
  
  const attempts = await getPasswordResetAttempt(clientIp);
  
  if (attempts) {
    // Reset window if expired
    if (now - attempts.firstAttempt > windowMs) {
      await deletePasswordResetAttempt(clientIp);
      return true;
    }
    
    // Check if limit exceeded
    if (attempts.count >= SECURITY_CONFIG.RATE_LIMITING.PASSWORD_RESET_PER_IP) {
      throw new AppError('Too many password reset attempts. Try again later', 429);
    }
  }
  
  return true;
};

/**
 * Record password reset attempt
 */
const recordPasswordResetAttempt = async (clientIp) => {
  if (!clientIp || typeof clientIp !== 'string') {
    return;
  }
  
  const now = Date.now();
  const windowMs = SECURITY_CONFIG.RATE_LIMITING.PASSWORD_RESET_WINDOW_HOURS * 60 * 60 * 1000;
  const windowSeconds = Math.ceil(windowMs / 1000);
  
  // Get current attempts or initialize new record
  const attempts = await getPasswordResetAttempt(clientIp) || { count: 0, firstAttempt: now };
  
  // Reset if window expired
  if (now - attempts.firstAttempt > windowMs) {
    attempts.count = 1;
    attempts.firstAttempt = now;
  } else {
    attempts.count++;
  }
  
  // Save to Redis with expiration
  await savePasswordResetAttempt(clientIp, attempts, windowSeconds);
};

/**
 * Clean up expired entries (call periodically)
 * Note: Not strictly necessary with Redis as we're setting expiry times
 * but keeping as a safety measure for any keys without expiry
 */
const cleanupExpiredEntries = async () => {
  // Redis handles expirations automatically with TTL settings
  // This function is kept for any manual cleanup needs
  logger.debug('Redis handles automatic expiry of security tokens');
};

// No need to run cleanupExpiredEntries anymore since Redis handles TTL
// setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

module.exports = {
  SECURITY_CONFIG,
  validatePasswordStrength,
  checkPasswordHistory,
  checkLoginRateLimit,
  recordLoginAttempt,
  checkAccountLockout,
  recordFailedLogin,
  clearFailedLogins,
  generateTokens,
  verifyToken,
  revokeToken,
  revokeAllUserTokens,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  checkPasswordResetRateLimit,
  recordPasswordResetAttempt,
  cleanupExpiredEntries,
  getUserLockout
};