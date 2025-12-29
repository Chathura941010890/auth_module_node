const express = require('express');
const specialFunctionRouter = express.Router();
const SpecialFunctionController = require('../controllers/special.function.controller');

/**
 * @swagger
 * tags:
 *   name: SpecialFunctions
 *   description: Special function endpoints
 */

/**
 * @swagger
 * /specialFunctions/getAllSpecialFunctions:
 *   get:
 *     summary: Get all special functions
 *     tags: [SpecialFunctions]
 *     responses:
 *       200:
 *         description: List of special functions
 */
specialFunctionRouter.get('/specialFunctions/getAllSpecialFunctions',  SpecialFunctionController.getAllSpecialFunctions);

/**
 * @swagger
 * /specialFunctions/createSpecialFunction:
 *   post:
 *     summary: Create a new special function
 *     tags: [SpecialFunctions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Special function created
 */
specialFunctionRouter.post('/specialFunctions/createSpecialFunction',  SpecialFunctionController.createSpecialFunction);

/**
 * @swagger
 * /specialFunctions/updateSpecialFunction:
 *   put:
 *     summary: Update a special function
 *     tags: [SpecialFunctions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Special function updated
 */
specialFunctionRouter.put('/specialFunctions/updateSpecialFunction',  SpecialFunctionController.updateSpecialFunction);

/**
 * @swagger
 * /specialFunctions/archiveSpecialFunction:
 *   put:
 *     summary: Archive a special function
 *     tags: [SpecialFunctions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Special function archived
 */
specialFunctionRouter.put('/specialFunctions/archiveSpecialFunction',  SpecialFunctionController.archiveSpecialFunction);

module.exports = specialFunctionRouter;
