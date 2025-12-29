const express = require('express');
const fs = require('fs');
const path = require('path');
const { sanitizeFilePath } = require('../utils/commandSecurityUtils');
const router = express.Router();

router.get('/documentation', (req, res) => {
    // Use sanitized path to prevent path traversal
    const safePath = sanitizeFilePath('README.md', path.join(__dirname, '../../'));
    
    if (!safePath) {
        return res.status(400).json({ message: 'Invalid file path.' });
    }
    
    // Additional security: ensure we're only reading the README file
    if (!safePath.endsWith('README.md')) {
        return res.status(400).json({ message: 'Access denied to requested file.' });
    }
    
    fs.readFile(safePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Documentation read error:', err.message);
            return res.status(500).json({ message: 'Could not read documentation file.' });
        }
        res.type('text/markdown').send(data);
    });
});

module.exports = router;
