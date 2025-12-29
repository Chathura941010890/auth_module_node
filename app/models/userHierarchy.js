const { DataTypes } = require('sequelize');
const sequelize = require("../database/index.js");
const User = require('./user');

const UserHierarchy = sequelize.define('UserHierarchy', {
  id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  reporter_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  reportee_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  active_status: {
    type: DataTypes.ENUM('0', '1'),
    allowNull: false,
    defaultValue: '1',
  },
  created_by: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  updated_by: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'tbl_user_hierarchies',
  timestamps: false,
  indexes: [
    { fields: ['reporter_id'] },
    { fields: ['reportee_id'] },
    { fields: ['reporter_id', 'reportee_id'], unique: true },
    { fields: ['active_status'] },
  ]
});

// Associations
UserHierarchy.belongsTo(User, { 
  as: 'reporter', 
  foreignKey: 'reporter_id', 
  onDelete: 'CASCADE' 
});

UserHierarchy.belongsTo(User, { 
  as: 'reportee', 
  foreignKey: 'reportee_id', 
  onDelete: 'CASCADE' 
});

User.hasMany(UserHierarchy, { 
  as: 'subordinates', 
  foreignKey: 'reporter_id' 
});

User.hasMany(UserHierarchy, { 
  as: 'supervisors', 
  foreignKey: 'reportee_id' 
});

module.exports = UserHierarchy;
