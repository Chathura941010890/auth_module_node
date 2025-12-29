const jwt = require('jsonwebtoken');
const { checkAccess } = require('../repositories/auth.repository');
const { error } = require('winston');

async function authenticateToken(req, res, next) {

  try {
    
    // First, try to get token from Authorization header
    let token = req.headers.authorization && req.headers.authorization.split(' ')[1];
    
    // If no token in header, try to get it from cookies
    if (!token) {
      // Check for 'authToken' cookie (from your controller)
      token = req.cookies?.authToken || req.cookies?.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, user) => {

      if (req.body.pathname === "/unauthorized") {
        return res.status(200).json({ message: 'Success' });
      }

      if (user) {
        let accessOk = await checkAccess(user.userId, req.body.pathname)

        if (!accessOk) {
          return res.status(401).json({ message: 'Unauthorized' });
        }
      }

      if (err) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      else {
        return res.status(200).json({ message: 'Success' });
      }

      req.user = user;
      next();
    });
  } catch (error) {
    console.error(`Authenticate function error: ${error}`);
  }
}

module.exports = authenticateToken;