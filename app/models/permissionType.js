const { DataTypes } = require('sequelize');

const sequelize = require("../database/index.js");

const PermissionType = sequelize.define('PermissionType', {
  id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  type: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
}, {
  tableName: 'tbl_permission_types',
  timestamps: false,
});

module.exports = PermissionType;
