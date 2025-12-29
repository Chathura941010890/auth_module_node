const AppError = require("../utils/appError");
const userService = require("../services/userService");
const { formatSuccessResponse, formatErrorResponse } = require("../utils/formatting/dateFormatter");
const { getUserCountries, checkBackOfficeSuperUser, getUserSystems } = require("../utils/utilFunctions");
const Country = require("../models/country");
const User = require("../models/user");
const UserCountry = require("../models/userCountry");
const System = require("../models/system");
const UserSystem = require("../models/userSystem");

const { Sequelize } = require("sequelize");


const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10 } = req.query;
    const result = await userService.getAllUsers(page, pageSize);
    
    res.status(200).json(formatSuccessResponse(result.data, "Users retrieved successfully", result.total));
  } catch (e) {
    res.status(e.statusCode || 400).json(formatErrorResponse(e.message));
  }
};

const getAllUsersBackoffice = async (req, res, next) => {
  try {

    const { page = 1, pageSize = 10 } = req.query;

    const userEmail = req.headers['x-user-email'] || req.headers['email'] || 'unknown';

    let userCountries = [];
    let userSystems = [];

    const isSuperUser = await checkBackOfficeSuperUser(userEmail);

    if(isSuperUser == "Yes"){
      userCountries = (await Country.findAll()).map(uc => uc.get({ plain: true })).map(item => item.name);    
      userSystems = (await System.findAll()).map(uc => uc.get({ plain: true })).map(item => item.name);    
    }
    else{
      try {
        userCountries = await getUserCountries(userEmail);
        userCountries = userCountries.map(item => item.Country.name) || [];
        if (!Array.isArray(userCountries)) userCountries = [];

        userSystems = await getUserSystems(userEmail);
        userSystems = userSystems.map(item => item.System.name) || [];
        if (!Array.isArray(userSystems)) userSystems = [];

      } catch (err) {
        userCountries = [];
        userSystems = [];
      }

    }

    const usrCountryArr = userCountries || [];
    const usrSystemArr = userSystems || [];

    const result = await userService.getAllUsersBackoffice(page, pageSize, usrCountryArr, usrSystemArr, userEmail);

    res.status(200).json(formatSuccessResponse(result.data, "Users retrieved successfully", result.total));
  } catch (e) {

    res.status(e.statusCode || 400).json(formatErrorResponse(e.message));
  }
};

const addUser = async (req, res, next) => {
  try {

    // const originRec = req.headers['original-origin'];

    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 60000); // 60 second timeout
    });

    const createUserPromise = userService.createUser(req.body);
    

    const result = await Promise.race([createUserPromise, timeoutPromise]);
    
    res.status(200).json(formatSuccessResponse(null, result.message));
  } catch (e) {
    if (e.message === 'Request timeout') {
      res.status(408).json(formatErrorResponse('Request timeout - please try again'));
    } else {
      res.status(e.statusCode || 400).json(formatErrorResponse(e.message));
    }
  }
};

const resetPasswordByUser = async (req, res, next) => {
  try {

    const result = await userService.resetPasswordByUser(req.body);

    res.status(200).json({
      status: "Success",
      message: result.message,
    });
  } catch (e) {
    res.status(e.statusCode || 400).json({
      status: "Failure",
      message: e.message,
    });
  }
};

const updateUser = async (req, res, next) => {
  try {
    const result = await userService.updateUser(req.body);

    res.status(200).json({
      status: "Success",
      message: result.message,
    });
  } catch (e) {
    res.status(e.statusCode || 400).json({
      status: "Failure",
      message: e.message,
    });
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { tokenReset, currentPassword, newPassword } = req.body;
    const result = await userService.changePassword(tokenReset, currentPassword, newPassword);

    res.status(200).send({
      status: "Success",
      message: result.message,
      data: result.data
    });
  } catch (e) {
    res.status(e.statusCode || 400).send({
      status: "Failure",
      message: e.message,
    });
  }
};

const getUsersByDepartmentAndSystem = async (req, res, next) => {
  try {
    if (!req.query.Department || !req.query.System) {
      throw new Error("Department and System is required!");
    }

    const departmentName = req.query.Department;
    const systemName = req.query.System;

    const users = await userService.getUsersByDepartmentAndSystem(departmentName, systemName);
    
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (err) {
    res.status(400).send({
      message: err.message || "Some error occurred while retrieving the data.",
    });
  }
};

const allUsers = (req, res, next) => {
  try {
    userService.getAllUsersFromRawQuery()
      .then((data) => {
        res.status(200).json({
          status: "success",
          length: data?.length,
          data: data,
        });
      })
      .catch((err) => next(new AppError(err)));
  } catch (e) {
    res.status(400).json({
      status: "Failure",
      message: e.message,
    });
  }
};

const getUserDataByID = async (req, res, next) => {
  try {
    const userData = await userService.getUserById(req.params.id);

    res.status(200).json({
      status: "success",
      data: userData,
    });
  } catch (e) {
    res.status(400).json({
      status: "Failure",
      message: e.message,
    });
  }
};

const getUserDataByEmail = async (req, res, next) => {
  try {
    const userData = await userService.getUserDataByEmail(req.params.email);

    res.status(200).json({
      status: "success",
      data: userData,
    });
  } catch (e) {
    res.status(400).json({
      status: "Failure",
      message: e.message,
    });
  }
};

const getUserDataByEmailLike = async (req, res, next) => {
  try {
    const userData = await userService.getUserDataByEmailLike(req.params.email);

    res.status(200).json({
      status: "success",
      data: userData,
    });
  } catch (e) {
    res.status(400).json({
      status: "Failure",
      message: e.message,
    });
  }
};

const getUsersFactoryByUserID = async (req, res, next) => {
  try {
    const returnData = await userService.getUserFactory(req.params.id);

    res.status(200).json({
      status: "success",
      data: returnData,
    });
  } catch (e) {
    res.status(400).json({
      status: "Failure",
      message: e.message,
    });
  }
};

const COEUsers = async (req, res, next) => {
  try {
    const COE = await userService.getCOEUsers();

    res.status(200).json({
      status: "success",
      data: COE,
    });
  } catch (e) {
    next(new AppError(e, 500));
  }
};

const getUsersBySystemAndRole = async (req, res, next) => {
  try {
    if (!req.params.System) {
      return res.status(400).json({
        success: false,
        messege: "System is required!",
      });
    }

    const users = await userService.getUsersBySystemAndRole(req.params.System, req.params.Role);
    
    res.status(200).json(users);
  } catch (e) {
    res.status(500).send({
      message: e.message || "Internal Server Error",
    });
  }
};

const getAllUserDataByID = async (req, res, next) => {
  try {
    const users = await userService.getAllUserDataById(req.params.id);

    if (users) {
      return res.status(200).send({
        status: "Success",
        data: users,
      });
    } else {
      return res.status(200).send({
        status: "Success",
        data: [],
      });
    }
  } catch (e) {
    res.status(400).send({
      status: "Failure",
      message: e.message,
    });
  }
};

const getAllUserDataByEmail = async (req, res, next) => {
  try {
    const users = await userService.getAllUserDataByEmail(req.params.email);

    if (users) {
      return res.status(200).send({
        status: "Success",
        data: users,
      });
    } else {
      return res.status(200).send({
        status: "Success",
        data: [],
      });
    }
  } catch (e) {
    res.status(400).send({
      status: "Failure",
      message: e.message,
    });
  }
};

const getUsersByCustomer = async (req, res, next) => {
  try {
    const customerName = req.query.Customer;

    if (!customerName) {
      throw new AppError("Customer name is required!", 400);
    }

    const transformedUsers = await userService.getUsersByCustomer(customerName);

    res.status(200).json({
      status: "success",
      data: transformedUsers,
    });
  } catch (e) {
    next(new AppError(e, 500));
  }
};

const resetPassword = async (req, res, next) => {
  try {

    const userEmail = 'chathuraj@inqube.com'// req.headers['x-user-email'] || 'unknown';

    let userCountries = [];
    let userSystems = [];

    const isSuperUser = await checkBackOfficeSuperUser(userEmail);

    if(isSuperUser == "Yes"){
      userCountries = (await Country.findAll()).map(uc => uc.get({ plain: true })).map(item => item.name); 
      userSystems = (await System.findAll()).map(uc => uc.get({ plain: true })).map(item => item.name);       
    }
    else{
      try {

        userCountries = await getUserCountries(userEmail);
        userCountries = userCountries.map(item => item.Country.name) || [];
        if (!Array.isArray(userCountries)) userCountries = [];

        userSystems = await getUserSystems(userEmail);
        userSystems = userSystems.map(item => item.System.name) || [];
        if (!Array.isArray(userSystems)) userSystems = [];

      } catch (err) {
        userCountries = [];
        userSystems = [];
      }

    }

    const usrCountryArr = userCountries || [];
    const usrSystemArr = userSystems || [];

    const resetUser = await User.findAll({
      where: {
        [Sequelize.Op.and]: [
          Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("email")),
            Sequelize.fn("LOWER", userEmail)
          ),
          { is_active: 1 }
        ]
      },
      include: [
        {
          model: UserCountry,
          include: [
            {
              model: Country
            }
          ]
        },
        {
          model: UserSystem,
          include: [
            {
              model: System
            }
          ]
        }
      ]
    });

    const resetUserPlain = resetUser.map(uc => uc.get({ plain: true }))    

    if (
      !resetUserPlain.length ||
      !resetUserPlain[0].UserCountries ||
      !resetUserPlain[0].UserCountries.some(country => usrCountryArr.includes(country.Country.name)) ||
      !resetUserPlain[0].UserSystems ||
      !resetUserPlain[0].UserSystems.some(system => usrSystemArr.includes(system.System.name))
    ) {
      throw new Error(`User (${req.body.email}) does not belong to your countries - ${usrCountryArr.toString()} or systems - ${usrSystemArr.toString()}`);
    }


    const { email, newPassword, resetBy } = req.body;
    const result = await userService.resetPassword(email, newPassword, resetBy, userEmail);

    res.status(200).send({
      status: "Success",
      message: result.message,
    });
  } catch (e) {
    res.status(e.statusCode || 400).send({
      status: "Failure",
      message: e.message,
    });
  }
};

const askFromSuperAdmin = async (req, res, next) => {
  try {

    const userEmail = req.headers['x-user-email'] || 'unknown';

    const isSuperUser = await checkBackOfficeSuperUser(userEmail);

    if(isSuperUser == "Yes"){
      throw new AppError('Already you are a super admin!')
    }

    const { superAdmins, fileds, message } = req.body;
    const result = await userService.askFromSuperAdmin(superAdmins, fileds, message, userEmail);

    res.status(200).send({
      status: "Success",
      message: result.message,
    });
  } catch (e) {
    res.status(e.statusCode || 400).send({
      status: "Failure",
      message: e.message,
    });
  }
};

const getSuperUsers = async (req, res, next) => {
  try {

    const result = await userService.getSuperUsers();
    
    res.status(200).json(formatSuccessResponse(result, "Super users retrieved successfully"));
  } catch (e) {
    
    res.status(e.statusCode || 400).json(formatErrorResponse(e.message));
  }
};

const getUsersDataByIDs = async (req, res, next) => {
  try {
    const ids = req.params.ids.split(',').map(id => id.trim()).filter(Boolean);
    if (!ids.length) return res.status(400).json({ message: 'No user IDs provided' });
    const users = await userService.getUsersDataByIDs(ids);
    res.status(200).json({
      status: 'Success',
      data: users
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      status: 'Failure',
      message: error.message
    });
  }
};

// Fetch multiple users by emails (comma-separated)
const getUsersDataByEmails = async (req, res, next) => {
  try {
    const emails = req.params.emails.split(',').map(e => e.trim()).filter(Boolean);
    if (!emails.length) return res.status(400).json({ message: 'No emails provided' });
    const users = await userService.getUsersDataByEmails(emails);
    res.status(200).json({
      status: 'Success',
      data: users
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      status: 'Failure',
      message: error.message
    });
  }
};


module.exports = {
  getAllUsers,
  addUser,
  resetPasswordByUser,
  allUsers,
  getUserDataByID,
  getUserDataByEmail,
  updateUser,
  getUsersByDepartmentAndSystem,
  changePassword,
  getAllUsersBackoffice,
  COEUsers,
  getUsersFactoryByUserID,
  getUsersBySystemAndRole,
  getAllUserDataByID,
  getUsersByCustomer,
  resetPassword,
  getUsersDataByIDs,
  getUsersDataByEmails,
  getUserDataByEmailLike,
  getAllUserDataByEmail,
  askFromSuperAdmin,
  getSuperUsers
};
