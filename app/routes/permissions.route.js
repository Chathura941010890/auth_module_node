const express = require('express');
const permissionsRouter  = express.Router(); 
const controller = require('../controllers/permissions.controller'); 

/**
 * @swagger
 * tags:
 *   name: Permissions
 *   description: Permission management endpoints
 */

/**
 * @swagger
 * /permissions/getAllPermissions:
 *   get:
 *     summary: Get all permissions
 *     tags: [Permissions]
 *     responses:
 *       200:
 *         description: List of permissions
 */
permissionsRouter.get('/getAllPermissions', controller.getAllPermissions);

/**
 * @swagger
 * /permissions/permissionsByRoleDept/{system_id}/{role_id}/{dept_id}:
 *   get:
 *     summary: Get permissions by role, department, and system
 *     tags: [Permissions]
 *     parameters:
 *       - in: path
 *         name: system_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: role_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: dept_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Permissions for the specified role, department, and system
 */
permissionsRouter.get('/permissionsByRoleDept/:system_id/:role_id/:dept_id', controller.permissionsByRoleDept);

/**
 * @swagger
 * /permissions/savePermissions:
 *   post:
 *     summary: Save permissions
 *     tags: [Permissions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Permissions saved
 */
permissionsRouter.post('/savePermissions', controller.savePermissions);

/**
 * @swagger
 * /permissions/getAllPermissionTypes:
 *   get:
 *     summary: Get all permission types
 *     tags: [Permissions]
 *     responses:
 *       200:
 *         description: List of permission types
 */
permissionsRouter.get('/getAllPermissionTypes', controller.getAllPermissionTypes);

/**
 * @swagger
 * /permissions/getPermissionTypeByUserSystemScreen/{user_id}/{system_id}/{screen_path}:
 *   get:
 *     summary: Get permission type by user, system, and screen
 *     tags: [Permissions]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: system_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: screen_path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Permission type for the specified user, system, and screen
 */
permissionsRouter.get('/getPermissionTypeByUserSystemScreen/:user_id/:system_id/:screen_path', controller.getPermissionTypeByUserSystemScreen);

module.exports = permissionsRouter