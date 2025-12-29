const express = require("express");
const userHierarchyRouter = express.Router();
const controller = require("../controllers/userHierarchy.controller");

/**
 * @swagger
 * tags:
 *   name: User Hierarchy
 *   description: User hierarchy management endpoints
 */

/**
 * @swagger
 * /user-hierarchy:
 *   get:
 *     summary: Get all user hierarchies
 *     description: Retrieve all active user hierarchy relationships with reporter and reportee details
 *     tags: [User Hierarchy]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hierarchies retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
userHierarchyRouter.get("/user-hierarchy",  controller.getAllHierarchies);

/**
 * @swagger
 * /user-hierarchy/reportees/{reporterId}:
 *   get:
 *     summary: Get reportees by reporter ID
 *     description: Retrieve all subordinates (employees) who report to a specific manager/supervisor in descending order
 *     tags: [User Hierarchy]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reporterId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The reporter (manager/supervisor) user ID
 *     responses:
 *       200:
 *         description: Reportees retrieved successfully
 *       400:
 *         description: Invalid reporter ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
userHierarchyRouter.get("/user-hierarchy/reportees/:reporterId",  controller.getReporteesByReporterId);

/**
 * @swagger
 * /user-hierarchy/reporters/{reporteeId}:
 *   get:
 *     summary: Get reporters by reportee ID
 *     description: Retrieve all managers/supervisors that a specific employee reports to in ascending order
 *     tags: [User Hierarchy]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reporteeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The reportee (employee) user ID
 *     responses:
 *       200:
 *         description: Reporters retrieved successfully
 *       400:
 *         description: Invalid reportee ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
userHierarchyRouter.get("/user-hierarchy/reporters/:reporteeId",  controller.getReportersByReporteeId);

/**
 * @swagger
 * /user-hierarchy:
 *   post:
 *     summary: Create a new user hierarchy relationship
 *     description: Create a new reporting relationship between a manager and an employee
 *     tags: [User Hierarchy]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reporter_id
 *               - reportee_id
 *               - created_by
 *             properties:
 *               reporter_id:
 *                 type: integer
 *                 description: The manager/supervisor user ID
 *               reportee_id:
 *                 type: integer
 *                 description: The employee user ID
 *               created_by:
 *                 type: integer
 *                 description: User ID who created this hierarchy
 *     responses:
 *       201:
 *         description: Hierarchy created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
userHierarchyRouter.post("/user-hierarchy",  controller.createHierarchy);

/**
 * @swagger
 * /user-hierarchy/{id}/status:
 *   put:
 *     summary: Update hierarchy status
 *     description: Activate or deactivate a user hierarchy relationship
 *     tags: [User Hierarchy]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The hierarchy ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - active_status
 *               - updated_by
 *             properties:
 *               active_status:
 *                 type: string
 *                 enum: ['0', '1']
 *                 description: Active status (1 for active, 0 for inactive)
 *               updated_by:
 *                 type: integer
 *                 description: User ID who updated this hierarchy
 *     responses:
 *       200:
 *         description: Hierarchy status updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Hierarchy not found
 *       500:
 *         description: Server error
 */
userHierarchyRouter.put("/user-hierarchy/:id/status",  controller.updateHierarchyStatus);

/**
 * @swagger
 * /user-hierarchy/{id}:
 *   delete:
 *     summary: Delete (deactivate) user hierarchy
 *     description: Soft delete a user hierarchy relationship by setting active_status to '0'
 *     tags: [User Hierarchy]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The hierarchy ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updated_by
 *             properties:
 *               updated_by:
 *                 type: integer
 *                 description: User ID who deleted this hierarchy
 *     responses:
 *       200:
 *         description: Hierarchy deleted successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Hierarchy not found
 *       500:
 *         description: Server error
 */
userHierarchyRouter.delete("/user-hierarchy/:id",  controller.deleteHierarchy);

module.exports = userHierarchyRouter;
