const express = require('express');
const departmentRouter = express.Router();
const DepartmentController = require('../controllers/department.controller');

/**
 * @swagger
 * tags:
 *   name: Departments
 *   description: Department management endpoints
 */

/**
 * @swagger
 * /departments/getAllDepartments:
 *   get:
 *     summary: Get all departments
 *     tags: [Departments]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of departments
 */
departmentRouter.get('/departments/getAllDepartments',  DepartmentController.getAllDepartments);

/**
 * @swagger
 * /departments/createDepartment:
 *   post:
 *     summary: Create a new department
 *     tags: [Departments]
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
 *         description: Department created
 */
departmentRouter.post('/departments/createDepartment',  DepartmentController.createDepartment);

/**
 * @swagger
 * /departments/updateDepartment:
 *   put:
 *     summary: Update a department
 *     tags: [Departments]
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
 *         description: Department updated
 */
departmentRouter.put('/departments/updateDepartment',  DepartmentController.updateDepartment);

/**
 * @swagger
 * /departments/archiveDepartment:
 *   put:
 *     summary: Archive a department
 *     tags: [Departments]
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
 *         description: Department archived
 */
departmentRouter.put('/departments/archiveDepartment',  DepartmentController.archiveDepartment);

/**
 * @swagger
 * /departments/getDepartmentsBySystem/{systemName}:
 *   get:
 *     summary: Get departments by system
 *     tags: [Departments]
 *     parameters:
 *       - in: path
 *         name: systemName
 *         required: true
 *         schema:
 *           type: string
 *         description: System name
 *     responses:
 *       200:
 *         description: List of departments
 */
departmentRouter.get('/departments/getDepartmentsBySystem/:systemName', DepartmentController.getDepartmentsBySystem);

module.exports = departmentRouter;
