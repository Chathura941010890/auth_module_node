const { DataTypes } = require('sequelize');
const Country = require('./country');

const sequelize = require("../database/index.js");

const Factory = sequelize.define('Factory', {
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
  country_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: Country,
      key: 'id'
    }
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
  tableName: 'tbl_factories',
  timestamps: false,
  indexes: [
    { fields: ['name'] },
    { fields: ['country_id'] },
  ]
});

Factory.belongsTo(Country, { foreignKey: 'country_id', onDelete: 'CASCADE' });
Country.hasMany(Factory, { foreignKey: 'country_id' });

module.exports = Factory;
