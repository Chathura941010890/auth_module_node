const { DataTypes } = require('sequelize');
const System = require('./system');

const sequelize = require("../database/index.js");

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  description: {
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
  tableName: 'tbl_roles',
  timestamps: false,
  indexes: [
    { fields: ['description'] },
    { fields: ['system_id'] },
  ]
});

Role.belongsTo(System, { foreignKey: 'system_id', onDelete: 'CASCADE' });
System.hasMany(Role, { foreignKey: 'system_id' });

module.exports = Role;
