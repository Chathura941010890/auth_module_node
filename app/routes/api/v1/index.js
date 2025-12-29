const express = require('express');
const router = express.Router();

// Import all v1 routes
const authRoutes = require('../../auth.route');
const userRoutes = require('../../user.route');
const customerRoutes = require('../../customer.route');
const countryRoutes = require('../../country.route');
const factoryRoutes = require('../../factory.route');
const roleRoutes = require('../../role.route');
const screenRoutes = require('../../screen.route');
const spRoutes = require('../../special.function.route');
const departmentRoutes = require('../../department.route');
const systemRoutes = require('../../system.route');
const permissionRoutes = require('../../permissions.route');
const apiGatewayRoute = require('../../apiGateway.route');
const emailRoute = require('../../email.route');

// Register all routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/customers', customerRoutes);
router.use('/countries', countryRoutes);
router.use('/factories', factoryRoutes);
router.use('/roles', roleRoutes);
router.use('/screens', screenRoutes);
router.use('/special-functions', spRoutes);
router.use('/departments', departmentRoutes);
router.use('/systems', systemRoutes);
router.use('/permissions', permissionRoutes);
router.use('/gateway', apiGatewayRoute);
router.use('/email', emailRoute);

module.exports = router;
