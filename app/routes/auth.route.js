const express = require('express');
const authRouter  = express.Router(); 
const authController = require('../controllers/auth.controller');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */

/**
 * @swagger
 * /auth/signIn:
 *   post:
 *     summary: User sign in
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: User signed in
 */
authRouter.post('/signIn', authController.signIn);

authRouter.post('/refreshToken', authController.refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out
 */
authRouter.post('/logout', authController.logout);

/**
 * @swagger
 * /auth/logoutAll:
 *   post:
 *     summary: Logout from all devices for current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out from all devices
 */
authRouter.post('/logoutAll', authController.logoutAll);

/**
 * @swagger
 * /auth/logoutAllUsers:
 *   post:
 *     summary: Logout all users from the system (admin only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out all users
 *       403:
 *         description: Admin privileges required
 */
authRouter.post('/logoutAllUsers', authController.logoutAllUsers);
authRouter.post('/ssoCallback', authController.ssoCallback);
authRouter.post('/signInSSO', authController.signInSSO);

module.exports = authRouter; 