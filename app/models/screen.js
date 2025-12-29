const { DataTypes } = require('sequelize');
const System = require('./system');

const sequelize = require("../database/index.js");

const Screen = sequelize.define('Screen', {
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
  system_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: System,
      key: 'id',
    },
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  main_icon: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: "fa fa-circle"
  },
  secondary_icon: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: "fa fa-circle"
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
  tableName: 'tbl_screens',
  timestamps: false,
});

Screen.belongsTo(System, { foreignKey: 'system_id', onDelete: 'CASCADE' });
System.hasMany(Screen, { foreignKey: 'system_id' });

module.exports = Screen;
