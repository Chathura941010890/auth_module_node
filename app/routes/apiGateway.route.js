const express = require('express');
const router  = express.Router(); 
const controller = require('../controllers/apiGateway.controller');

/**
 * @swagger
 * tags:
 *   name: ApiGateway
 *   description: API Gateway endpoints
 */

/**
 * @swagger
 * /apiGateway/getAllServices:
 *   get:
 *     summary: Get all services
 *     tags: [ApiGateway]
 *     responses:
 *       200:
 *         description: List of services
 */
router.get('/getAllServices', controller.getAllServices);

/**
 * @swagger
 * /apiGateway/getAllUnauthorizedPaths:
 *   get:
 *     summary: Get all unauthorized paths
 *     tags: [ApiGateway]
 *     responses:
 *       200:
 *         description: List of unauthorized paths
 */
router.get('/getAllUnauthorizedPaths', controller.getAllUnauthorizedPaths);

/**
 * @swagger
 * /apiGateway/createService:
 *   post:
 *     summary: Create a new service
 *     tags: [ApiGateway]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Service created
 */
router.post('/createService', controller.createService);

/**
 * @swagger
 * /apiGateway/createUnauthorizedPath:
 *   post:
 *     summary: Create a new unauthorized path
 *     tags: [ApiGateway]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Unauthorized path created
 */
router.post('/createUnauthorizedPath', controller.createUnauthorizedPath);

/**
 * @swagger
 * /apiGateway/service/{id}:
 *   put:
 *     summary: Update a service
 *     tags: [ApiGateway]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Service updated
 */
router.put('/service/:id', controller.updateService);

/**
 * @swagger
 * /apiGateway/service/{id}:
 *   delete:
 *     summary: Delete a service
 *     tags: [ApiGateway]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Service deleted
 */
router.delete('/service/:id', controller.deleteService);

/**
 * @swagger
 * /apiGateway/unauthorized-path/{id}:
 *   put:
 *     summary: Update an unauthorized path
 *     tags: [ApiGateway]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Unauthorized path updated
 */
router.put('/unauthorized-path/:id', controller.updateUnauthorizedPath);

/**
 * @swagger
 * /apiGateway/unauthorized-path/{id}:
 *   delete:
 *     summary: Delete an unauthorized path
 *     tags: [ApiGateway]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Unauthorized path deleted
 */
router.delete('/unauthorized-path/:id', controller.deleteUnauthorizedPath);

module.exports = router;