const express = require('express');
const router = express.Router();
const controller = require('../controllers/downtime.controller');
const { authentication } = require('../middleware/authentication');

/**
 * @swagger
 * /downtime:
 *   post:
 *     summary: Create a new downtime record
 *     description: Schedule a system downtime for maintenance
 *     tags: [Downtime]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - system_id
 *               - from_time
 *               - to_time
 *             properties:
 *               system_id:
 *                 type: integer
 *                 description: ID of the system to schedule downtime for
 *               from_time:
 *                 type: string
 *                 format: date-time
 *                 description: Start time of the downtime
 *               to_time:
 *                 type: string
 *                 format: date-time
 *                 description: End time of the downtime
 *               reason:
 *                 type: string
 *                 description: Reason for the downtime
 *     responses:
 *       200:
 *         description: Downtime created successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post('/downtime/createDowntime', controller.createDowntime);

/**
 * @swagger
 * /downtime:
 *   get:
 *     summary: Get all downtime records
 *     description: Retrieve a list of all scheduled downtimes with pagination
 *     tags: [Downtime]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of records per page
 *     responses:
 *       200:
 *         description: List of downtimes
 *       500:
 *         description: Server error
 */
router.get('/downtime/getAllDowntimes', controller.getAllDowntimes);

/**
 * @swagger
 * /downtime/{id}:
 *   get:
 *     summary: Get a specific downtime
 *     description: Retrieve details of a specific downtime by ID
 *     tags: [Downtime]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Downtime ID
 *     responses:
 *       200:
 *         description: Downtime details
 *       404:
 *         description: Downtime not found
 *       500:
 *         description: Server error
 */
router.get('/downtime/:id', controller.getDowntimeById);

/**
 * @swagger
 * /downtime/{id}:
 *   patch:
 *     summary: Update a downtime record
 *     description: Update the finished or archived status of a downtime
 *     tags: [Downtime]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Downtime ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               finished:
 *                 type: integer
 *                 enum: [0, 1]
 *                 description: Whether the downtime is finished (1) or not (0)
 *               archived:
 *                 type: integer
 *                 enum: [0, 1]
 *                 description: Whether the downtime is archived (1) or not (0)
 *     responses:
 *       200:
 *         description: Downtime updated successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Downtime not found
 *       500:
 *         description: Server error
 */
router.patch('/downtime/updateDowntime/:id', controller.updateDowntime);

/**
 * @swagger
 * /downtime/auto-update:
 *   post:
 *     summary: Auto-update completed downtimes
 *     description: Mark all downtimes that have passed their end time as finished
 *     tags: [Downtime]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Downtimes updated successfully
 *       500:
 *         description: Server error
 */
router.post('/downtime/auto-update', controller.updateCompletedDowntimes);

module.exports = router;
