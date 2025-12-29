const express = require('express');
const screenRouter = express.Router();
const ScreenController = require('../controllers/screen.controller');

/**
 * @swagger
 * tags:
 *   name: Screens
 *   description: Screen management endpoints
 */

/**
 * @swagger
 * /screens/getAllScreens:
 *   get:
 *     summary: Get all screens
 *     tags: [Screens]
 *     responses:
 *       200:
 *         description: List of screens
 */
screenRouter.get('/screens/getAllScreens', ScreenController.getAllScreens);

/**
 * @swagger
 * /screens/getAllScreensBySystem/{system_id}:
 *   get:
 *     summary: Get all screens by system
 *     tags: [Screens]
 *     parameters:
 *       - in: path
 *         name: system_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: System ID
 *     responses:
 *       200:
 *         description: List of screens
 */
screenRouter.get('/screens/getAllScreensBySystem/:system_id', ScreenController.getAllScreensBySystem);

/**
 * @swagger
 * /screens/createScreen:
 *   post:
 *     summary: Create a new screen
 *     tags: [Screens]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Screen created
 */
screenRouter.post('/screens/createScreen', ScreenController.createScreen);

/**
 * @swagger
 * /screens/updateScreen:
 *   put:
 *     summary: Update a screen
 *     tags: [Screens]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Screen updated
 */
screenRouter.put('/screens/updateScreen', ScreenController.updateScreen);

/**
 * @swagger
 * /screens/archiveScreen:
 *   put:
 *     summary: Archive a screen
 *     tags: [Screens]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Screen archived
 */
screenRouter.put('/screens/archiveScreen', ScreenController.archiveScreen);

module.exports = screenRouter;
