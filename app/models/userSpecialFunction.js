const { DataTypes } = require('sequelize');
const User = require('./user');
const SpecialFunction = require('./specialFunction');

const sequelize = require("../database/index.js");

const UserFunction = sequelize.define('UserFunction', {
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
  function_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: SpecialFunction,
      key: 'id'
    }
  },

}, {
  tableName: 'tbl_user_functions',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['function_id'] },
    { fields: ['user_id', 'function_id'], unique: true },
  ]
});

UserFunction.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(UserFunction, { foreignKey: 'user_id' });

UserFunction.belongsTo(SpecialFunction, { foreignKey: 'function_id', onDelete: 'CASCADE' });
SpecialFunction.hasMany(UserFunction, { foreignKey: 'function_id' });

module.exports = UserFunction;
