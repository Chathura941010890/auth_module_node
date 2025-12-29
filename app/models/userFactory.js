const { DataTypes } = require('sequelize');
const User = require('./user');
const Factory = require('./factory');

const sequelize = require("../database/index.js");

const UserFactory = sequelize.define('UserFactory', {
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
  factory_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: Factory,
      key: 'id'
    }
  },

}, {
  tableName: 'tbl_user_factories',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['factory_id'] },
    { fields: ['user_id', 'factory_id'], unique: true },
  ]
});

UserFactory.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(UserFactory, { foreignKey: 'user_id' });

UserFactory.belongsTo(Factory, { foreignKey: 'factory_id', onDelete: 'CASCADE' });
Factory.hasMany(UserFactory, { foreignKey: 'factory_id' });

module.exports = UserFactory;
