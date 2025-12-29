const express = require('express');
const router = express.Router();
const EmailController = require('../controllers/email.controller');

/**
 * @swagger
 * tags:
 *   name: Email
 *   description: Email endpoints
 */

/**
 * @swagger
 * /email/getUsers:
 *   post:
 *     summary: Get users by system, role, and department
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: List of users
 */
router.post('/email/getUsers', EmailController.getUsersBySystemRoleDepartment);

/**
 * @swagger
 * /email/sendEmails:
 *   post:
 *     summary: Send emails
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Emails sent
 */
router.post('/email/sendEmails', EmailController.sendEmails);

module.exports = router;
