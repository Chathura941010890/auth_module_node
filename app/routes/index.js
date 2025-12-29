const express = require('express');
const router  = express.Router(); 
const authenticateToken = require('../utils/auth');
const authenticateTokenOnly = require('../utils/auth2');

const utilFunctions = require('../utils/utilFunctions'); 

// Middleware function to prepend the common prefix
router.use('/auth/api/v1', (req, res, next) => {
    req.url = '/auth/api/v1' + req.url;
    next();
});

router.post('/authenticateToken', authenticateToken, (req, res) => {
    res.json({ message: 'This is a protected route', user: req.user });
});

router.post('/authenticateTokenOnly', authenticateTokenOnly, (req, res) => {
    res.json({ message: 'This is a protected route', user: req.user });
});

router.get('/healthCheck', utilFunctions.healthCheck);

module.exports = router; 