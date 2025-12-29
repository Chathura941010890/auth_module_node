const { DataTypes } = require('sequelize');
const User = require('./user');
const System = require('./system');

const sequelize = require("../database/index.js");

const UserSystem = sequelize.define('UserSystem', {
  id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  system_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: System,
      key: 'id'
    }
  },

}, {
  tableName: 'tbl_user_systems',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['system_id'] },
    { fields: ['user_id', 'system_id'], unique: true },
  ]
});

UserSystem.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(UserSystem, { foreignKey: 'user_id' });

UserSystem.belongsTo(System, { foreignKey: 'system_id', onDelete: 'CASCADE' });
System.hasMany(UserSystem, { foreignKey: 'system_id' });

module.exports = UserSystem;
