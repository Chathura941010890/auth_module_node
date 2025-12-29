const { DataTypes } = require('sequelize');
const User = require('./user.js');

const sequelize = require("../database/index.js");
const Country = require('./country.js');

const UserCountry = sequelize.define('UserCountry', {
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
  country_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: Country,
      key: 'id'
    }
  },

}, {
  tableName: 'tbl_user_countries',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['country_id'] },
    { fields: ['user_id', 'country_id'], unique: true },
  ]
});

UserCountry.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(UserCountry, { foreignKey: 'user_id' });

UserCountry.belongsTo(Country, { foreignKey: 'country_id', onDelete: 'CASCADE' });
Country.hasMany(UserCountry, { foreignKey: 'country_id' });

module.exports = UserCountry;
