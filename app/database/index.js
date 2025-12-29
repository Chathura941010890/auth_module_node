const Sequelize = require('sequelize');
const dotenv = require('dotenv');
const logger = require('../utils/logger');
const { safeGetEnv } = require('../utils/commandSecurityUtils');
const { loadEnvironment } = require('../utils/envLoader');

// Ensure environment variables are loaded first
loadEnvironment();

// Log the current environment for debugging
const nodeEnv = process.env.NODE_ENV || 'development';
console.log(`Database initializing in ${nodeEnv} environment`);

const host = safeGetEnv('DB_HOST', 'localhost', { isHost: true });
const username = safeGetEnv('DB_USER', 'root', { maxLength: 100 });

// Get the password directly from process.env to avoid any potential sanitization issues
const password = process.env.DB_PASSWORD || '';

const dbName = safeGetEnv('DB_NAME', 'auth_db', { 
  maxLength: 64, 
  pattern: /^[a-zA-Z0-9_]+$/ 
});
const dialect = safeGetEnv('DB_DIALECT', 'mysql', { 
  maxLength: 20,
  pattern: /^(mysql|postgres|sqlite|mariadb|mssql)$/
});

const pool = {
  max: parseInt(safeGetEnv('DB_POOL_MAX', '100', { isNumeric: true })) || 100,
  min: parseInt(safeGetEnv('DB_POOL_MIN', '0', { isNumeric: true })) || 0,
  acquire: parseInt(safeGetEnv('DB_POOL_ACQUIRE', '30000', { isNumeric: true })) || 30000,
  idle: parseInt(safeGetEnv('DB_POOL_IDLE', '5000', { isNumeric: true })) || 5000
};

console.log('Database host:', host);


const sequelize = new Sequelize(dbName, username, password, {
  host: host,
  dialect: dialect,
  pool: pool,
  reconnect: true,
  dialectOptions: {
    multipleStatements: true,
  },
  retry: {
    max: 10,
  },
  logging : false
});

sequelize.addHook('afterConnect', (connection) => {
  console.log('Connected to the database:', connection.config.database);
});

sequelize.addHook('beforeDisconnect', () => {
  console.log('About to disconnect from the database.');
});

// Log connection details (without exposing password)
console.log(`Attempting to connect to database:
  - Host: ${host}
  - Database: ${dbName}
  - User: ${username}
  - Dialect: ${dialect}
  - Password provided: ${password ? 'Yes' : 'No'}
`);

sequelize
  .authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
    
    // Proceed with synchronizing only after successful connection
    return sequelize.sync()
      .then(() => {
        console.log('Database synchronized successfully.');
      })
      .catch(syncErr => {
        logger.error('Unable to synchronize the database:', syncErr);
        // Log more details about the synchronization error
        if (syncErr.parent) {
          logger.error('Sync parent error:', {
            code: syncErr.parent.code,
            errno: syncErr.parent.errno,
            sqlMessage: syncErr.parent.sqlMessage,
            sqlState: syncErr.parent.sqlState
          });
        }
      });
  })
  .catch(err => {
    logger.error('Unable to connect to the database:', err);
    // Log more detailed connection error information
    if (err.original) {
      logger.error('Connection error details:', {
        code: err.original.code,
        errno: err.original.errno,
        sqlMessage: err.original.sqlMessage,
        sqlState: err.original.sqlState,
        address: err.original.address,
        port: err.original.port
      });
    }
    
    // Exit process with error in test/production environments
    // to allow process manager to restart the application
    if (nodeEnv === 'test' || nodeEnv === 'production') {
      console.error('Critical database connection error. Exiting process for restart.');
      // Give time for logs to flush
      setTimeout(() => process.exit(1), 1000);
    }
  });


module.exports = sequelize;