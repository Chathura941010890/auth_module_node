const { DataTypes } = require('sequelize');

const sequelize = require("../database/index.js");

const Customer = sequelize.define('Customer', {
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

}, {
  tableName: 'tbl_customers',
  timestamps: false,
  indexes: [
    { fields: ['name'] },
  ]
});

module.exports = Customer;
