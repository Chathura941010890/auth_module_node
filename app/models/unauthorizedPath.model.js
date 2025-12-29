const { DataTypes } = require('sequelize');
const sequelizeSR = require('../database/indexSR.js');

const UnauthorizedPath = sequelizeSR.define('UnauthorizedPath', {
  id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  module: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  path_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
}, {
  tableName: 'unauthorized_paths',
  timestamps: false,
});

module.exports = UnauthorizedPath;
