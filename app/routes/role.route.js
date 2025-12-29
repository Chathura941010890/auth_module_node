const express = require('express');
const roleRouter = express.Router();
const RoleController = require('../controllers/role.controller');

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Role management endpoints
 */

/**
 * @swagger
 * /roles/getAllRoles:
 *   get:
 *     summary: Get all roles
 *     tags: [Roles]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of roles
 */
roleRouter.get('/roles/getAllRoles',  RoleController.getAllRoles);

/**
 * @swagger
 * /roles/createRole:
 *   post:
 *     summary: Create a new role
 *     tags: [Roles]
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
 *         description: Role created
 */
roleRouter.post('/roles/createRole',  RoleController.createRole);

/**
 * @swagger
 * /roles/updateRole:
 *   put:
 *     summary: Update a role
 *     tags: [Roles]
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
 *         description: Role updated
 */
roleRouter.put('/roles/updateRole',  RoleController.updateRole);

/**
 * @swagger
 * /roles/archiveRole:
 *   put:
 *     summary: Archive a role
 *     tags: [Roles]
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
 *         description: Role archived
 */
roleRouter.put('/roles/archiveRole',  RoleController.archiveRole);

module.exports = roleRouter;
