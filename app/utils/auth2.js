const jwt = require('jsonwebtoken');

async function authenticateTokenOnly(req, res, next) {
  try {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let responseSent = false;

    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, user) => {
      if (err) {
        responseSent = true;
        return res.status(403).json({ message: 'Forbidden' });
      }

      req.user = user;
      if (!responseSent) {
        next();
      }
    });
    
  } catch (error) {
    console.error(`Authenticate function error: ${error}`);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = authenticateTokenOnly;
