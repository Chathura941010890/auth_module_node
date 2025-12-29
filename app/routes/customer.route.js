const express = require('express');
const customerRouter  = express.Router(); 
const customerController = require('../controllers/customer.controller'); 

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: Customer management endpoints
 */

/**
 * @swagger
 * /customers/createCustomer:
 *   post:
 *     summary: Create a new customer
 *     tags: [Customers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Customer created
 */
customerRouter.post('/customers/createCustomer', customerController.createCustomer); 

/**
 * @swagger
 * /customers/getAllCustomers:
 *   get:
 *     summary: Get all customers
 *     tags: [Customers]
 *     responses:
 *       200:
 *         description: List of customers
 */
customerRouter.get('/customers/getAllCustomers', customerController.getAllCustomers); 

/**
 * @swagger
 * /customers/updateCustomer:
 *   put:
 *     summary: Update a customer
 *     tags: [Customers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Customer updated
 */
customerRouter.put('/customers/updateCustomer', customerController.updateCustomer); 

/**
 * @swagger
 * /customers/getById/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: Customer data
 */
customerRouter.get('/customers/getById/:id', customerController.getById);

/**
 * @swagger
 * /customers/getCustomersByIDs/{ids}:
 *   get:
 *     summary: Get multiple customers by IDs
 *     tags: [Customers]
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
customerRouter.get('/customers/getCustomersByIDs/:ids', customerController.getCustomersByIDs);


module.exports = customerRouter;
