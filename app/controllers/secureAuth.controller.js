/**
 * Secure Authentication Controllers
 * Implements secure authentication endpoints with comprehensive security controls
 */

const AppError = require('../utils/appError');
const { 
  secureSignIn, 
  changePassword, 
  initiatePasswordReset, 
  completePasswordReset 
} = require('../repositories/secureAuth.repository');
const { 
  generateTokens, 
  verifyToken, 
  revokeToken, 
  revokeAllUserTokens,
  SECURITY_CONFIG 
} = require('../utils/authSecurityUtils');
const { getClientIp } = require('../middleware/secureAuthentication');

/**
 * Secure sign-in endpoint
 */
const signIn = async (req, res, next) => {
  try {
    const { email, password, deviceToken } = req.body;
    const clientIp = await getClientIp(req);

    // Input validation
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    // Additional input sanitization
    const sanitizedEmail = email.toString().trim();
    const sanitizedPassword = password.toString();

    // Length checks to prevent DoS
    if (sanitizedEmail.length > 254 || sanitizedPassword.length > 200) {
      throw new AppError('Email or password is too long', 400);
    }

    // Perform secure sign-in
    const result = await secureSignIn(sanitizedEmail, sanitizedPassword, deviceToken, req);

    // Set secure cookie for refresh token (optional, for web clients)
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS in production
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/auth/refresh'
      });
    }

    // Remove refresh token from response body (it's in cookie)
    const responseData = { ...result };
    delete responseData.refreshToken;

    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      data: responseData
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token using refresh token
 */
const refreshToken = async (req, res, next) => {
  try {
    const clientIp = await getClientIp(req);

    // Get refresh token from cookie or header
    let refreshToken = req.cookies?.refreshToken;
    
    if (!refreshToken) {
      // Fallback to Authorization header
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        refreshToken = authHeader.slice(7);
      }
    }

    if (!refreshToken) {
      throw new AppError('Refresh token is required', 401);
    }

    // Verify refresh token
    const jwtSecret = process.env.JWT_SECRET_KEY;
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new AppError('Authentication service configuration error', 500);
    }

    const decoded = verifyToken(refreshToken, jwtSecret, 'refresh');

    // Get user data for new token
    const { user } = require('../models');
    const User = await user.findOne({
      where: { 
        id: decoded.userId,
        archived: 0 
      },
      attributes: { exclude: ['password', 'password_history'] }
    });

    if (!User) {
      throw new AppError('User not found', 404);
    }

    // Generate new access token
    const tokenPayload = {
      userId: User.id,
      email: User.email,
      refreshTime: new Date().toISOString(),
      clientIp: clientIp
    };

    const { accessToken, refreshToken: newRefreshToken, tokenId, expiresIn } = generateTokens(tokenPayload, jwtSecret);

    // Revoke old refresh token
    revokeToken(decoded.userId, decoded.tokenId);

    // Set new refresh token cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:  24 * 60 * 60 * 1000, // 7 days
      path: '/auth/refresh'
    });

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken,
        tokenId,
        expiresIn
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Secure logout endpoint
 */
const logout = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    const tokenId = req.user?.tokenId;

    if (userId && tokenId) {
      // Revoke current token
      revokeToken(userId, tokenId);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken', { path: '/auth/refresh' });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Logout from all devices
 */
const logoutAll = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('User authentication required', 401);
    }

    // Revoke all user tokens
    const revokedCount = revokeAllUserTokens(userId);

    // Clear refresh token cookie
    res.clearCookie('refreshToken', { path: '/auth/refresh' });

    res.status(200).json({
      success: true,
      message: `Logged out from ${revokedCount} devices successfully`
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Change password endpoint
 */
const changeUserPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('User authentication required', 401);
    }

    if (!currentPassword || !newPassword) {
      throw new AppError('Current password and new password are required', 400);
    }

    // Change password
    const result = await changePassword(userId, currentPassword, newPassword);

    // Optionally revoke all tokens to force re-login with new password
    // revokeAllUserTokens(userId);

    res.status(200).json({
      success: true,
      message: result.message
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Initiate password reset
 */
const initiatePasswordResetRequest = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    const result = await initiatePasswordReset(email, req);

    res.status(200).json({
      success: true,
      message: result.message
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Complete password reset
 */
const completePasswordResetRequest = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      throw new AppError('Reset token and new password are required', 400);
    }

    const result = await completePasswordReset(token, newPassword, req);

    res.status(200).json({
      success: true,
      message: result.message
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Verify token endpoint (for other services)
 */
const verifyAuthToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new AppError('Token is required', 400);
    }

    const jwtSecret = process.env.JWT_SECRET_KEY;
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new AppError('Authentication service configuration error', 500);
    }

    const decoded = verifyToken(token, jwtSecret, 'access');

    res.status(200).json({
      success: true,
      message: 'Token is valid',
      data: {
        userId: decoded.userId,
        email: decoded.email,
        tokenId: decoded.tokenId,
        issuedAt: decoded.iat
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get user authentication status
 */
const getAuthStatus = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      throw new AppError('User authentication required', 401);
    }

    const { user } = require('../models');
    const User = await user.findOne({
      where: { 
        id: userId,
        archived: 0 
      },
      attributes: ['id', 'email', 'first_name', 'last_name', 'has_password_changed', 'created_at']
    });

    if (!User) {
      throw new AppError('User not found', 404);
    }

    // Check password age
    const passwordAge = Date.now() - new Date(User.created_at).getTime();
    const maxPasswordAge = SECURITY_CONFIG.PASSWORD.MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const passwordExpiresSoon = passwordAge > (maxPasswordAge * 0.9); // Warn at 90%

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: User.id,
          email: User.email,
          firstName: User.first_name,
          lastName: User.last_name,
          hasPasswordChanged: User.has_password_changed === 1,
          passwordExpiresSoon
        },
        tokenInfo: {
          tokenId: req.user.tokenId,
          issuedAt: req.user.iat
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Security information endpoint
 */
const getSecurityInfo = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        passwordPolicy: {
          minLength: SECURITY_CONFIG.PASSWORD.MIN_LENGTH,
          requireUppercase: SECURITY_CONFIG.PASSWORD.REQUIRE_UPPERCASE,
          requireLowercase: SECURITY_CONFIG.PASSWORD.REQUIRE_LOWERCASE,
          requireNumbers: SECURITY_CONFIG.PASSWORD.REQUIRE_NUMBERS,
          requireSpecialChars: SECURITY_CONFIG.PASSWORD.REQUIRE_SPECIAL_CHARS,
          maxAgeDays: SECURITY_CONFIG.PASSWORD.MAX_AGE_DAYS
        },
        sessionPolicy: {
          accessTokenExpiry: SECURITY_CONFIG.JWT.ACCESS_TOKEN_EXPIRY,
          refreshTokenExpiry: SECURITY_CONFIG.JWT.REFRESH_TOKEN_EXPIRY,
          maxConcurrentSessions: SECURITY_CONFIG.JWT.MAX_CONCURRENT_SESSIONS
        },
        accountSecurity: {
          maxFailedAttempts: SECURITY_CONFIG.ACCOUNT_LOCKOUT.MAX_FAILED_ATTEMPTS,
          lockoutDuration: `${SECURITY_CONFIG.ACCOUNT_LOCKOUT.LOCKOUT_DURATION_MINUTES} minutes`
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  signIn,
  refreshToken,
  logout,
  logoutAll,
  changeUserPassword,
  initiatePasswordResetRequest,
  completePasswordResetRequest,
  verifyAuthToken,
  getAuthStatus,
  getSecurityInfo
};