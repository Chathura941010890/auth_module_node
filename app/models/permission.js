const { DataTypes } = require('sequelize');
const Role = require('./role');
const Department = require('./department');
const PermissionType = require('./permissionType');
const Screen = require('./screen');

const sequelize = require("../database/index.js");

const Permission = sequelize.define('Permission', {
  id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  role_id: {
    type: DataTypes.BIGINT,
    references: {
      model: Role,
      key: 'id',
    },
  },
  department_id: {
    type: DataTypes.BIGINT,
    references: {
      model: Department,
      key: 'id',
    },
  },
  access_type_id: {
    type: DataTypes.BIGINT,
    references: {
      model: PermissionType,
      key: 'id',
    },
  },
  screen_id: {
    type: DataTypes.BIGINT,
    references: {
      model: Screen,
      key: 'id',
    },
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
}, {
  tableName: 'tbl_permissions',
  timestamps: false,
});

Permission.belongsTo(Role, { foreignKey: 'role_id', onDelete: 'CASCADE' });
Role.hasMany(Permission, { foreignKey: 'role_id' });

Permission.belongsTo(Department, { foreignKey: 'department_id', onDelete: 'CASCADE' });
Department.hasMany(Permission, { foreignKey: 'department_id' });

Permission.belongsTo(PermissionType, { foreignKey: 'access_type_id', onDelete: 'CASCADE' });
PermissionType.hasMany(Permission, { foreignKey: 'access_type_id' });

Permission.belongsTo(Screen, { foreignKey: 'screen_id', onDelete: 'CASCADE' });
Screen.hasMany(Permission, { foreignKey: 'screen_id' });

module.exports = Permission;
