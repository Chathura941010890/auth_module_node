const { DataTypes } = require('sequelize');

const sequelize = require("../database/index.js");
const System = require('./system.js');

const DowntimeLogs = sequelize.define('DowntimeLogs', {
  id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  system_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: System,
      key: 'id'
    }
  },
  from_time: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  to_time: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  reason: {
    type: DataTypes.STRING(256),
    allowNull: false,
  },
  finished: {
    type: DataTypes.TINYINT,
    allowNull: false,
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
  tableName: 'tbl_downtime_logs',
  timestamps: false,
});

DowntimeLogs.belongsTo(System, { foreignKey: 'system_id', onDelete: 'CASCADE' });
System.hasMany(DowntimeLogs, { foreignKey: 'system_id' });

module.exports = DowntimeLogs;
