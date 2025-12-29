const winston = require('winston');

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'serverCrashErrors.log', level: 'error' }),
  ],
  exceptionHandlers: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'exceptions.log' }),
  ],
});

logger.exceptions.handle(
  new winston.transports.Console(),
  new winston.transports.File({ filename: 'exceptions.log' })
);

module.exports = logger;
