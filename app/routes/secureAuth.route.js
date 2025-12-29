/**
 * Secure Authentication Routes
 * Implements secure authentication endpoints with proper middleware
 */

const express = require('express');
const router = express.Router();

// Import secure controllers and middleware
const {
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
} = require('../controllers/secureAuth.controller');

const {
  authenticateToken,
  authenticateRefreshToken,
  validateApiKey,
  setSecurityHeaders
} = require('../middleware/secureAuthentication');

// Apply security headers to all routes
router.use(setSecurityHeaders);

/**
 * @swagger
 * /auth/api/v1/signin:
 *   post:
 *     summary: Secure user sign-in
 *     description: Authenticate user with email and password using enhanced security controls
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 description: User password
 *                 example: SecurePassword123!
 *               deviceToken:
 *                 type: string
 *                 description: Optional device token for push notifications
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Authentication successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       description: JWT access token
 *                     tokenId:
 *                       type: string
 *                       description: Unique token identifier
 *                     expiresIn:
 *                       type: string
 *                       example: "15m"
 *                     user:
 *                       type: object
 *                       description: User information
 *       401:
 *         description: Invalid credentials or account locked
 *       429:
 *         description: Too many login attempts
 *       355:
 *         description: Password change required
 *       356:
 *         description: Password expired
 */
router.post('/signin', validateApiKey, signIn);

/**
 * @swagger
 * /auth/api/v1/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Generate new access token using refresh token
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Token refreshed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     tokenId:
 *                       type: string
 *                     expiresIn:
 *                       type: string
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', validateApiKey, authenticateRefreshToken, refreshToken);

/**
 * @swagger
 * /auth/api/v1/logout:
 *   post:
 *     summary: Logout user
 *     description: Revoke current session token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logged out successfully
 *       401:
 *         description: Authentication required
 */
router.post('/logout', validateApiKey, authenticateToken, logout);

/**
 * @swagger
 * /auth/api/v1/logout-all:
 *   post:
 *     summary: Logout from all devices
 *     description: Revoke all session tokens for the user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out from all devices successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logged out from 3 devices successfully
 *       401:
 *         description: Authentication required
 */
router.post('/logout-all', validateApiKey, authenticateToken, logoutAll);

/**
 * @swagger
 * /auth/api/v1/change-password:
 *   post:
 *     summary: Change user password
 *     description: Change user password with current password verification
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Current password
 *               newPassword:
 *                 type: string
 *                 description: New password (must meet security requirements)
 *                 example: NewSecurePassword456!
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password changed successfully
 *       400:
 *         description: Password validation failed
 *       401:
 *         description: Current password is incorrect
 */
router.post('/change-password', validateApiKey, authenticateToken, changeUserPassword);

/**
 * @swagger
 * /auth/api/v1/password-reset-request:
 *   post:
 *     summary: Request password reset
 *     description: Initiate password reset process by email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address for password reset
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Password reset instructions sent (if email exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: If the email exists, you will receive password reset instructions
 *       429:
 *         description: Too many password reset attempts
 */
router.post('/password-reset-request', validateApiKey, initiatePasswordResetRequest);

/**
 * @swagger
 * /auth/api/v1/password-reset-complete:
 *   post:
 *     summary: Complete password reset
 *     description: Reset password using reset token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token from email
 *               newPassword:
 *                 type: string
 *                 description: New password (must meet security requirements)
 *                 example: NewSecurePassword789!
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password reset successfully
 *       400:
 *         description: Invalid or expired reset token
 */
router.post('/password-reset-complete', validateApiKey, completePasswordResetRequest);

/**
 * @swagger
 * /auth/api/v1/verify-token:
 *   post:
 *     summary: Verify authentication token
 *     description: Verify if an access token is valid (for other services)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Token is valid
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     email:
 *                       type: string
 *                     tokenId:
 *                       type: string
 *                     issuedAt:
 *                       type: number
 *       401:
 *         description: Invalid or expired token
 */
router.post('/verify-token', validateApiKey, verifyAuthToken);

/**
 * @swagger
 * /auth/api/v1/status:
 *   get:
 *     summary: Get authentication status
 *     description: Get current user authentication status and information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authentication status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         firstName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         hasPasswordChanged:
 *                           type: boolean
 *                         passwordExpiresSoon:
 *                           type: boolean
 *                     tokenInfo:
 *                       type: object
 *                       properties:
 *                         tokenId:
 *                           type: string
 *                         issuedAt:
 *                           type: number
 *       401:
 *         description: Authentication required
 */
router.get('/status', validateApiKey, authenticateToken, getAuthStatus);

/**
 * @swagger
 * /auth/api/v1/security-info:
 *   get:
 *     summary: Get security policy information
 *     description: Get information about password policies and security settings
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Security information retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     passwordPolicy:
 *                       type: object
 *                       properties:
 *                         minLength:
 *                           type: number
 *                           example: 12
 *                         requireUppercase:
 *                           type: boolean
 *                           example: true
 *                         requireLowercase:
 *                           type: boolean
 *                           example: true
 *                         requireNumbers:
 *                           type: boolean
 *                           example: true
 *                         requireSpecialChars:
 *                           type: boolean
 *                           example: true
 *                         maxAgeDays:
 *                           type: number
 *                           example: 90
 *                     sessionPolicy:
 *                       type: object
 *                       properties:
 *                         accessTokenExpiry:
 *                           type: string
 *                           example: "15m"
 *                         refreshTokenExpiry:
 *                           type: string
 *                           example: "7d"
 *                         maxConcurrentSessions:
 *                           type: number
 *                           example: 3
 *                     accountSecurity:
 *                       type: object
 *                       properties:
 *                         maxFailedAttempts:
 *                           type: number
 *                           example: 5
 *                         lockoutDuration:
 *                           type: string
 *                           example: "30 minutes"
 */
router.get('/security-info', validateApiKey, getSecurityInfo);

/**
 * @swagger
 * /auth/api/v1/healthCheck:
 *   get:
 *     summary: Health check endpoint
 *     description: Check if the authentication service is running
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 service:
 *                   type: string
 *                   example: "auth-module"
 */
router.get('/healthCheck', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'auth-module',
    version: process.env.npm_package_version || '1.0.0'
  });
});

module.exports = router;