const { DataTypes } = require('sequelize');
const User = require('./user');
const Department = require('./department');

const sequelize = require("../database/index.js");

const UserDepartment = sequelize.define('UserDepartment', {
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
  department_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: Department,
      key: 'id'
    }
  },

}, {
  tableName: 'tbl_user_departments',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['department_id'] },
    { fields: ['user_id', 'department_id'], unique: true },
  ]
});

UserDepartment.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(UserDepartment, { foreignKey: 'user_id' });

UserDepartment.belongsTo(Department, { foreignKey: 'department_id', onDelete: 'CASCADE' });
Department.hasMany(UserDepartment, { foreignKey: 'department_id' });

module.exports = UserDepartment;
