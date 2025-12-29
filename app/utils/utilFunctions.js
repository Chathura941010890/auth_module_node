const Country = require('../models/country');
const Role = require('../models/role');
const System = require('../models/system');
const User = require('../models/user');
const UserCountry = require('../models/userCountry');
const UserRole = require('../models/userRole');
const UserSystem = require('../models/userSystem');
const { getCurrentMoment } = require('./dateUtils');
const { Sequelize } = require("sequelize");

const validateEmail = (email) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
};

const formatDatetime = ()=>{
    const d = getCurrentMoment();
    const month = d.format('MM');
    const day = d.format('DD');
    const year = d.format('YYYY');
    
    const datetime = year + "-"
                    + month + "-" 
                    + day + " "  
                    + d.format('HH') + ":"  
                    + d.format('mm') + ":" 
                    + d.format('ss');
    return datetime;
}

const healthCheck = (req, res) =>{
    res.status(200).json({
        status: "Success",
        message: "App Running!",
    });
    return
}

const isUserAvailable = async (email) => {
    const userAvail = await User.findOne({
      where: {
       [Sequelize.Op.and]: [
          Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("email")),
            Sequelize.fn("LOWER", email)
          ),
          { is_active: 1 }
       ]
      }
    });

    return userAvail || "None";
}

const getUserCountries = async (email) => {
    try {
        const user = await isUserAvailable(email);

        if (user === "None") {
            return [];
        }

        const userCountries = await UserCountry.findAll({
            where: {
                user_id: user.id
            },
            include: [
                {
                    model: Country
                }
            ]
        });

        // Always return an array, even if empty
        return userCountries.map(uc => uc.get({ plain: true }));
    } catch (err) {
        // On error, return empty array so controller logic is safe
        return [];
    }
}

const getUserSystems = async (email) => {
    try {
        const user = await isUserAvailable(email);

        if (user === "None") {
            return [];
        }

        const userSystems = await UserSystem.findAll({
            where: {
                user_id: user.id
            },
            include: [
                {
                    model: System
                }
            ]
        });

        // Always return an array, even if empty
        return userSystems.map(uc => uc.get({ plain: true }));
    } catch (err) {
        // On error, return empty array so controller logic is safe
        return [];
    }
}

const checkBackOfficeSuperUser = async (email) => {
    try {
        const user = await isUserAvailable(email);

        if (user === "None") {
            return "No";
        }

        const userRoles = await UserRole.findAll({
            where: {
                user_id: user.id
            },
            include: [
                {
                    model: Role
                }
            ]
        });

        let superUserRole = userRoles.map(uc => uc.get({ plain: true })).filter(
            item => item.role_id == 79 && item.Role.description == "BackofficeSuperAdmin"
        );

        if(superUserRole.length > 0){
            return "Yes";
        }
        else{            
            return "No";
        }

    } catch (err) {
        // On error, return empty array so controller logic is safe
        console.log(err);
        
        return "No";
    }
}

module.exports = {
    validateEmail,
    formatDatetime,
    healthCheck,
    isUserAvailable,
    getUserCountries,
    getUserSystems,
    checkBackOfficeSuperUser
}