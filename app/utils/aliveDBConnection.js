const user = require('../models/user');
const logger = require('./logger');
const { getCurrentDateForLogging } = require('./dateUtils');

const aliveConnection = async (req, res, next) => {
    try {
        console.log("Alive DB connection function called at - " , getCurrentDateForLogging());
        const email = 'chathuraj@inqube.com';
        const User = await user.findOne({ where: { email } });
    }
    catch (err) {
        logger.error(`Caught DB con alive error at - : ${getCurrentDateForLogging()} message - ${err.message}`);
    }
}

module.exports = {
    aliveConnection
}