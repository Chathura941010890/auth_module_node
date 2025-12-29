const {  DataTypes } = require('sequelize');
const sequelize = require("../database/index.js");

const User = sequelize.define('User', {
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
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
      validate: {
        isEmail: true,
      },
  },
  password: {
    type: DataTypes.STRING(300),
    allowNull: false,
  },
  mobile_no: {
    type: DataTypes.BIGINT,
  },
  is_active: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  email_verified_at: {
    type: DataTypes.DATE,
  },
  remember_token: {
    type: DataTypes.STRING(255),
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  created_by: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  updated_by: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  is_internal_user: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  comman_user_state: {
    type: DataTypes.STRING(50),
  },
  has_password_changed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  sso_login_enabled: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
  },
  wfx_username: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },

}, {
  tableName: 'tbl_users',
  timestamps: false,
  indexes: [
    { fields: ['email'], unique: true },
    { fields: ['is_active'] },
  ]
});

module.exports = User;
