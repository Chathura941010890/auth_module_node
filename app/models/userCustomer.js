const { DataTypes } = require('sequelize');
const User = require('./user');
const Customer = require('./customer');

const sequelize = require("../database/index.js");

const UserCustomer = sequelize.define('UserCustomer', {
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
  customer_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: Customer,
      key: 'id'
    }
  },

}, {
  tableName: 'tbl_user_customers',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['customer_id'] },
    { fields: ['user_id', 'customer_id'], unique: true },
  ]
});

UserCustomer.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(UserCustomer, { foreignKey: 'user_id' });

UserCustomer.belongsTo(Customer, { foreignKey: 'customer_id', onDelete: 'CASCADE' });
Customer.hasMany(UserCustomer, { foreignKey: 'customer_id' });

module.exports = UserCustomer;
