const express = require('express');
const userRouter  = express.Router(); 
const userController = require('../controllers/user.controller');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints
 */

/**
 * @swagger
 * /users/addUser:
 *   post:
 *     summary: Add a new user
 *     tags: [Users]
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
 *         description: User created
 */
userRouter.post('/users/addUser',  userController.addUser); 

//create password by user in first login
userRouter.post('/users/resetPasswordByUser',  userController.resetPasswordByUser); 


/**
 * @swagger
 * /users/getAllUsers:
 *   get:
 *     summary: Get all users (paginated)
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         description: Page size
 *     responses:
 *       200:
 *         description: List of users
 */
userRouter.get('/users/getAllUsers', userController.getAllUsers); 

/**
 * @swagger
 * /users/getAllUsersBackoffice:
 *   get:
 *     summary: Get all users from backoffice (paginated)
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         description: Page size
 *     responses:
 *       200:
 *         description: List of users
 */
userRouter.get('/users/getAllUsersBackoffice', userController.getAllUsersBackoffice); 


/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User data
 *       404:
 *         description: User not found
 */
userRouter.get('/users/:id', userController.getUserDataByID); 

/**
 * @swagger
 * /users/byIds/{ids}:
 *   get:
 *     summary: Get multiple users by IDs
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: ids
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated user IDs
 *     responses:
 *       200:
 *         description: List of users
 */
userRouter.get('/users/byIds/:ids', userController.getUsersDataByIDs); 

/**
 * @swagger
 * /users/byEmail/{email}:
 *   get:
 *     summary: Get user by email
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: User email
 *     responses:
 *       200:
 *         description: User data
 */
userRouter.get('/users/byEmail/:email', userController.getUserDataByEmail); 

/**
 * @swagger
 * /users/byEmailLike/{email}:
 *   get:
 *     summary: Get user by email like
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: User email
 *     responses:
 *       200:
 *         description: User data
 */
userRouter.get('/users/byEmailLike/:email', userController.getUserDataByEmailLike); 


/**
 * @swagger
 * /users/byEmails/{emails}:
 *   get:
 *     summary: Get multiple users by emails
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: emails
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated emails
 *     responses:
 *       200:
 *         description: List of users
 */
userRouter.get('/users/byEmails/:emails', userController.getUsersDataByEmails); 

/**
 * @swagger
 * /users/updateUser:
 *   put:
 *     summary: Update a user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: User updated
 */
userRouter.put('/users/updateUser', userController.updateUser); 

/**
 * @swagger
 * /users/getUsersByDepartmentAndSystem/get:
 *   get:
 *     summary: Get users by department and system
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: Department
 *         schema:
 *           type: string
 *         description: Department name
 *       - in: query
 *         name: System
 *         schema:
 *           type: string
 *         description: System name
 *     responses:
 *       200:
 *         description: List of users
 */
userRouter.get('/users/getUsersByDepartmentAndSystem/get', userController.getUsersByDepartmentAndSystem); 

/**
 * @swagger
 * /users/changePassword:
 *   post:
 *     summary: Change user password
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Password changed
 */
userRouter.post('/users/changePassword', userController.changePassword); 

/**
 * @swagger
 * /users/getUsersFactoryByUserID/{id}:
 *   get:
 *     summary: Get user's factory by user ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: Factory data
 */
userRouter.get('/users/getUsersFactoryByUserID/:id', userController.getUsersFactoryByUserID); 

/**
 * @swagger
 * /users/COEUsers/get:
 *   get:
 *     summary: Get COE users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of COE users
 */
userRouter.get('/users/COEUsers/get', userController.COEUsers); 

/**
 * @swagger
 * /getUsersBySystemAndRole/{System}/{Role}:
 *   get:
 *     summary: Get users by system and role
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: System
 *         required: true
 *         schema:
 *           type: string
 *         description: System name
 *       - in: path
 *         name: Role
 *         required: true
 *         schema:
 *           type: string
 *         description: Role name
 *     responses:
 *       200:
 *         description: List of users
 */
userRouter.get('/getUsersBySystemAndRole/:System/:Role', userController.getUsersBySystemAndRole); 

/**
 * @swagger
 * /getAllUserDataByID/{id}:
 *   get:
 *     summary: Get all user data by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User data with associations
 */
userRouter.get('/getAllUserDataByID/:id', userController.getAllUserDataByID); 

/**
 * @swagger
 * /getAllUserDataByEmail/{email}:
 *   get:
 *     summary: Get all user data by Email
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User Email
 *     responses:
 *       200:
 *         description: User data with associations
 */
userRouter.get('/getAllUserDataByEmail/:email', userController.getAllUserDataByEmail); 


/**
 * @swagger
 * /getUsersByCustomer:
 *   get:
 *     summary: Get users by customer
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: customerName
 *         schema:
 *           type: string
 *         description: Customer name
 *     responses:
 *       200:
 *         description: List of users
 */
userRouter.get('/getUsersByCustomer', userController.getUsersByCustomer);

/**
 * @swagger
 * /users/resetPassword:
 *   post:
 *     summary: Reset user password
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Password reset
 */
userRouter.post('/users/resetPassword', userController.resetPassword);

/**
 * @swagger
 * /users/askFromSuperAdmin:
 *   post:
 *     summary: Ask from super admin
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Ask from super admin
 */
userRouter.post('/users/askFromSuperUser', userController.askFromSuperAdmin);

/**
 * @swagger
 * /users/getSuperUsers:
 *   get:
 *     summary: Get users with BackofficeSuperAdmin role (role_id = 79)
 *     tags: [Users]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of super admin users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       is_active:
 *                         type: integer
 *       400:
 *         description: Error response
 */
userRouter.get('/getSuperUsers', userController.getSuperUsers);

module.exports = userRouter; 