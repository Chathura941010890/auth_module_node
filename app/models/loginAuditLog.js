const { DataTypes } = require('sequelize');
const sequelize = require('../database/index');

const LoginAuditLog = sequelize.define('LoginAuditLog', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  event_type: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'login_audit_logs',
  timestamps: false,
});

module.exports = LoginAuditLog;
