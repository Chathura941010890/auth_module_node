const { DataTypes } = require('sequelize');
const User = require('./user');
const Role = require('./role');

const sequelize = require("../database/index.js");

const UserRole = sequelize.define('UserRole', {
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
  role_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: Role,
      key: 'id'
    }
  },

}, {
  tableName: 'tbl_user_roles',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['role_id'] },
    { fields: ['user_id', 'role_id'], unique: true },
  ]
});

UserRole.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(UserRole, { foreignKey: 'user_id' });

UserRole.belongsTo(Role, { foreignKey: 'role_id', onDelete: 'CASCADE' });
Role.hasMany(UserRole, { foreignKey: 'role_id' });

module.exports = UserRole;
