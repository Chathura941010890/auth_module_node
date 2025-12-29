const Sequelize = require('sequelize');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

dotenv.config();


const host = process.env.DB_HOST;
const username = process.env.DB_USER;
const password = process.env.DB_PASSWORD;
const dialect = process.env.DB_DIALECT;
const pool = {
  max: parseInt(process.env.DB_POOL_MAX) || 100,
  min: parseInt(process.env.DB_POOL_MIN) || 0,
  acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
  idle: parseInt(process.env.DB_POOL_IDLE) || 5000
}

const dbNameSR = 'service_registry';

const sequelizeSR = new Sequelize(dbNameSR, username, password, {
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

sequelizeSR.addHook('afterConnect', (connection) => {
  console.log('Connected to the database:', connection.config.database);
});

sequelizeSR.addHook('beforeDisconnect', () => {
  console.log('About to disconnect from the database.');
});

sequelizeSR
  .authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    logger.error('Unable to connect to the database:', err);
  });

  sequelizeSR
  .sync()
  .then(() => {
    console.log('Database synchronized.');
  })
  .catch(err => {
    logger.error('Unable to synchronize the database:', err);
  });

module.exports = sequelizeSR