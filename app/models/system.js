const { DataTypes } = require('sequelize');

const sequelize = require("../database/index.js");

const System = sequelize.define('System', {
  id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  url: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  created_by: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  updated_by: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  archived: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  auto_logout_enabled: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
  },
  block_login_when_active_downtime: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
  },
  refresh_token_enabled: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
  },
  user_auto_register: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
  },
  auto_register_default_role: {
    type: DataTypes.BIGINT,
  },

}, {
  tableName: 'tbl_systems',
  timestamps: false,
  indexes: [
    { fields: ['name'] },
  ]
});

module.exports = System;
