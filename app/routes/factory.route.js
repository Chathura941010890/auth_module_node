const express = require('express');
const factoryRouter = express.Router();
const FactoryController = require('../controllers/factory.controller');

/**
 * @swagger
 * tags:
 *   name: Factories
 *   description: Factory management endpoints
 */

/**
 * @swagger
 * /factories/getAllFactories:
 *   get:
 *     summary: Get all factories
 *     tags: [Factories]
 *     responses:
 *       200:
 *         description: List of factories
 */
factoryRouter.get('/factories/getAllFactories', FactoryController.getAllFactories);

/**
 * @swagger
 * /factories/getFactoryByID/{id}:
 *   get:
 *     summary: Get factory by ID
 *     tags: [Factories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Factory ID
 *     responses:
 *       200:
 *         description: Factory data
 */
factoryRouter.get('/factories/getFactoryByID/:id', FactoryController.getFactoryByID);

/**
 * @swagger
 * /factories/getFactoriesByIDs/{ids}:
 *   get:
 *     summary: Get multiple factories by IDs
 *     tags: [Factories]
 *     parameters:
 *       - in: path
 *         name: ids
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated factory IDs
 *     responses:
 *       200:
 *         description: List of factories
 */
factoryRouter.get('/factories/getFactoriesByIDs/:ids', FactoryController.getFactoriesByIDs);

/**
 * @swagger
 * /factories/createFactory:
 *   post:
 *     summary: Create a new factory
 *     tags: [Factories]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Factory created
 */
factoryRouter.post('/factories/createFactory',  FactoryController.createFactory);

/**
 * @swagger
 * /factories/updateFactory:
 *   put:
 *     summary: Update a factory
 *     tags: [Factories]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Factory updated
 */
factoryRouter.put('/factories/updateFactory',  FactoryController.updateFactory);

/**
 * @swagger
 * /factories/archiveFactory:
 *   put:
 *     summary: Archive a factory
 *     tags: [Factories]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Factory archived
 */
factoryRouter.put('/factories/archiveFactory',  FactoryController.archiveFactory);

module.exports = factoryRouter;
