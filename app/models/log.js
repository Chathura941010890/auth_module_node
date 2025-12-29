const { DataTypes } = require('sequelize');
const sequelize = require('../database/index.js');

const Log = sequelize.define('Log', {
  id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  action_taken: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  table_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  column_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  from_value: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  to_value: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  time_stamp: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'tbl_logs',
  timestamps: false,
});

module.exports = Log;
