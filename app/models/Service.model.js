const { DataTypes } = require('sequelize');
const sequelizeSR = require('../database/indexSR.js');

const Service = sequelizeSR.define('Service', {
  id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  endpointId: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  endpointUrl: {
    type: DataTypes.STRING(300),
    allowNull: false,
  },
  description: {
      type: DataTypes.STRING(100),
      allowNull: true,
  },
}, {
  tableName: 'services',
  timestamps: false,
});

module.exports = Service;
