const express = require('express');
const systemRouter  = express.Router(); 
const SystemController = require('../controllers/system.controller');

/**
 * @swagger
 * tags:
 *   name: Systems
 *   description: System management endpoints
 */

/**
 * @swagger
 * /systems/getAllSystems:
 *   get:
 *     summary: Get all systems
 *     tags: [Systems]
 *     responses:
 *       200:
 *         description: List of systems
 */
systemRouter.get('/systems/getAllSystems', SystemController.getAllSystems);

/**
 * @swagger
 * /systems/createSystem:
 *   post:
 *     summary: Create a new system
 *     tags: [Systems]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: System created
 */
systemRouter.post('/systems/createSystem', SystemController.createSystem);

/**
 * @swagger
 * /systems/updateSystem:
 *   put:
 *     summary: Update a system
 *     tags: [Systems]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: System updated
 */
systemRouter.put('/systems/updateSystem', SystemController.updateSystem);

/**
 * @swagger
 * /systems/archiveSystem:
 *   put:
 *     summary: Archive a system
 *     tags: [Systems]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: System archived
 */
systemRouter.put('/systems/archiveSystem', SystemController.archiveSystem);

module.exports = systemRouter; 