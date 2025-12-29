const repo = require("../repositories/auth.repository");
const AppError = require("../utils/appError");
const { sendSuccessResponse, sendErrorResponse } = require("../utils/formatting/responseFormatter");
const { getClientIp } = require('../middleware/secureAuthentication');
const user = require('../models/user')
const { 
  generateTokens, 
  verifyToken, 
  revokeToken, 
  revokeAllUserTokens
} = require('../utils/authSecurityUtils');

const signIn = async (req, res, next) => {
    try {
        
        if (!req.body) {
            throw new AppError("No form data found", 404);
        }
        const clientIp = await getClientIp(req);

        const originRec = req.headers['original-origin'];
        
        const { email, password, deviceToken } = req.body;

        const data = await repo.signIn(email, password, deviceToken, system = originRec || "", clientIp || "");
        
        // Set secure cookie for refresh token & token (optional, for web clients)
        if (data.refreshToken) {
            res.cookie('refreshToken', data.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // HTTPS in production
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Changed from 'strict'
                maxAge: 24 * 60 * 60 * 1000, // 1d
                path: '/'
            });
        }

        if (data.token) {
            res.cookie('token', data.token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Changed from 'strict'
                maxAge: 15 * 60 * 1000, // 15 mins
                path: '/'
            });
        }

        // Remove refresh token from response body (it's in cookie)
        const responseData = { ...data };
        delete responseData.refreshToken;
        // delete responseData.token;

        return res.status(200).json(responseData);
        
    } catch (err) {
        // Determine proper status code for authentication errors
        let statusCode = 500; // Default to internal server error
        
        // Check for authentication-related errors
        if (err.message && (
            err.message.includes('authentication failed') || 
            err.message.includes('Invalid username') ||
            err.message.includes('Invalid password') ||
            err.message.includes('Azure AD authentication failed') ||
            err.message.includes('Wrong password') ||
            err.message.includes('User not found')
        )) {
            statusCode = 401;
        } else if (err.message && (
            err.message.includes('You need to change your password') ||
            err.message.includes('password change')
        )) {
            statusCode = 355; // Unprocessable Entity - requires password change
        } else if (err.message && (
            err.message.includes('account has been blocked') ||
            err.message.includes('login attempts limit exceeded')
        )) {
            statusCode = 423; // Locked - account is locked
        } else if (err.message && (
            err.message.includes('System temporarily unavailable') ||
            err.message.includes('maintenance in progress')
        )) {
            statusCode = 503; // Service Unavailable - maintenance mode
        } else if (err.message && (
            err.message.includes('No form data found') ||
            err.message.includes('Email is required') ||
            err.message.includes('Password is required')
        )) {
            statusCode = 400;
        }

        const responseObj = {
            success: false,
            message: err.message || "Authentication failed",
            error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        };
        
        return res.status(statusCode).json(responseObj);
    }
}

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
    if (!jwtSecret || jwtSecret.length < 20) {
      throw new AppError('Authentication service configuration error', 500);
    }

    const decoded = await verifyToken(refreshToken, jwtSecret, 'refresh');    

    // Get user data for new token
    const User = await user.findOne({
      where: { 
        id: decoded.userId,
        is_active: 1 
      },
      attributes: { exclude: ['password'] }
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

    const generatedToken = await generateTokens(tokenPayload, jwtSecret);
    

    // Set new refresh token cookie
    res.cookie('refreshToken', generatedToken.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Changed from 'strict'
        maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/'
    });

    res.cookie('token', generatedToken.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Changed from 'strict'
        maxAge: 15 * 60 * 1000, // 15 mins
        path: '/'
    });

    // Revoke old refresh token
    revokeToken(decoded.userId, decoded.tokenId);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: generatedToken.accessToken,
        // refreshToken: generatedToken.refreshToken,
        tokenId : generatedToken.tokenId,
        expiresIn: generatedToken.expiresIn
      }
    });

  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    const tokenId = req.user?.tokenId;

    if (userId && tokenId) {
      // Revoke current token
      revokeToken(userId, tokenId);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken', { path: '/' });

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
    const userId = req.body?.userId;

    if (!userId) {
      throw new AppError('User authentication required', 401);
    }

    // Revoke all user tokens
    const revokedCount = await revokeAllUserTokens(userId);

    // Clear refresh token cookie
    res.clearCookie('refreshToken', { path: '/' });
    res.clearCookie('token', { path: '/' });

    res.status(200).json({
      success: true,
      message: `Logged out from ${revokedCount} devices successfully`
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Logout all users from the system (admin only)
 */
const logoutAllUsers = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      throw new AppError('User authentication required', 401);
    }
    
    // Check if user is admin by verifying database
    const adminUser = await user.findOne({
      where: { 
        id: userId,
        is_active: 1
      },
      include: [
        {
          model: require('../models/userRole'),
          as: 'userRoles',
          include: [
            {
              model: require('../models/role'),
              as: 'role',
              where: {
                name: 'Admin'
              }
            }
          ]
        }
      ]
    });
    
    if (!adminUser) {
      throw new AppError('Admin privileges required', 403);
    }
    
    // Log this critical action
    console.log(`[CRITICAL ACTION] Admin user ${userId} initiated system-wide logout at ${new Date().toISOString()}`);
    
    // Get all users from database except the current admin
    const users = await user.findAll({
      where: { 
        is_active: 1,
        id: { [require('sequelize').Op.ne]: userId } // Don't log out the admin performing the action
      },
      attributes: ['id']
    });
    
    let totalRevokedCount = 0;
    
    // Revoke all tokens for each user
    for (const userRecord of users) {
      const revokedCount = await revokeAllUserTokens(userRecord.id);
      totalRevokedCount += revokedCount;
    }

    res.status(200).json({
      success: true,
      message: `Successfully logged out all users (revoked ${totalRevokedCount} tokens)`,
      usersAffected: users.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in logoutAllUsers:', error);
    next(error);
  }
};

const ssoCallback = async (req, res, next) => {
    try {
        const result = await repo.ssoCallback();
        res.status(200).json(result);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const signInSSO = async (req, res, next) => {
    try {
        
        if (!req.body) {
            throw new AppError("No form data found", 404);
        }
        const clientIp = await getClientIp(req);

        const originRec = req.headers['original-origin'];
        
        const { email, password, deviceToken } = req.body;

        const data = await repo.signInSSO(email, password, deviceToken, system = originRec || "", clientIp || "");
        
        // Set secure cookie for refresh token & token (optional, for web clients)
        if (data.refreshToken) {
            res.cookie('refreshToken', data.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // HTTPS in production
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Changed from 'strict'
                maxAge: 24 * 60 * 60 * 1000, // 1d
                path: '/'
            });
        }

        if (data.token) {
            res.cookie('token', data.token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Changed from 'strict'
                maxAge: 15 * 60 * 1000, // 15 mins
                path: '/'
            });
        }

        // Remove refresh token from response body (it's in cookie)
        const responseData = { ...data };
        delete responseData.refreshToken;
        // delete responseData.token;

        return res.status(200).json(responseData);
        
    } catch (err) {
        // Determine proper status code for authentication errors
        let statusCode = 500;
        
        if (err.message && (
            err.message.includes('authentication failed') || 
            err.message.includes('Invalid username') ||
            err.message.includes('Invalid password') ||
            err.message.includes('Azure AD authentication failed') ||
            err.message.includes('Wrong password') ||
            err.message.includes('User not found')
        )) {
            statusCode = 401;
        } else if (err.message && (
            err.message.includes('You need to change your password') ||
            err.message.includes('password change')
        )) {
            statusCode = 422; // Unprocessable Entity - requires password change
        } else if (err.message && (
            err.message.includes('account has been blocked') ||
            err.message.includes('login attempts limit exceeded')
        )) {
            statusCode = 423; // Locked - account is locked
        } else if (err.message && (
            err.message.includes('System temporarily unavailable') ||
            err.message.includes('maintenance in progress')
        )) {
            statusCode = 503; // Service Unavailable - maintenance mode
        } else if (err.message && (
            err.message.includes('No form data found') ||
            err.message.includes('Email is required') ||
            err.message.includes('Password is required')
        )) {
            statusCode = 400;
        }

        return res.status(statusCode).json({
            success: false,
            message: err.message || "Authentication failed",
            error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
}

module.exports = {
    signIn,
    refreshToken,
    logout,
    logoutAll,
    logoutAllUsers,
    ssoCallback,
    signInSSO
}