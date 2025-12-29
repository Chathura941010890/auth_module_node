const Permission = require("../models/permission");
const PermissionType = require('../models/permissionType.js')
const { Sequelize } = require('sequelize');
const Screen = require("../models/screen.js")
const User = require("../models/user");
const UserSystem = require("../models/userSystem");
const UserDepartment = require("../models/userDepartments");
const UserRole = require("../models/userRole");
const Department = require("../models/department.js");
const System = require("../models/system.js");
const Role = require("../models/role.js");
const { getCurrentDateForDB } = require('../utils/dateUtils');
const { getSuperUsers } = require("../services/userService.js");
const {  sendMessageToKafkaForNotification } = require('../kafka/controller.js');
const logger = require('../utils/logger');
const { Worker } = require('worker_threads');
const path = require('path');

const AppError = require('../utils/appError')

const getAllPermissions = async (req) => {
  try {
    const permissions = await Permission.findAll();

    return permissions;
  } catch (error) {
    throw new AppError(`Error fetching permissions: ${error.message}` || "Error occured", error.statusCode || 400);
  }
};

const permissionsByRoleDept = async (system_id, role_id, dept_id) => {
  try {
    
    let result = [];
    
    const whereConditions = {
      role_id: role_id,
      department_id: dept_id > 0 ? dept_id : null
    };

    result = await Permission.findAll({
      attributes: [
        ['id', 'permission_id']
      ],
      where: whereConditions,
      include: [
        {
          model: Screen,
          attributes: ['id', 'name', 'code', 'category'],
          where: {
            system_id: system_id,
            archived: 0
          },
          required: true
        },
        {
          model: PermissionType,
          attributes: [
            ['id', 'access_type_id'],
            ['type', 'access_type']
          ],
          required: true
        }
      ],
      raw: true,
      nest: true
    });

    result = result.map(item => ({
      permission_id: item.permission_id,
      access_type_id: item.PermissionType.access_type_id,
      access_type: item.PermissionType.access_type,
      name: item.Screen.name,
      code: item.Screen.code,
      category: item.Screen.category
    }));

    return result;
  } catch (error) {
    throw new AppError(`Error fetching permissions: ${error.message}` || "Error occured", error.statusCode || 400);
  }
};

const savePermissions = async (requ) => {
  try {
    const req = requ.body
    const permissions = await Permission.findAll({
      where : {
        id : req.permissionId
      }
    });

    const screen = await Screen.findAll({
      where : {
        name : req.screenName,
        code : req.screenCode,
        system_id : req.system
      }
    });

    const system = await System.findAll({
      where: {
        id: req.system
      }
    });

    const role = await Role.findAll({
      where: {
        id: req.role
      }
    });

    let dept = null;

    if(req.department > 0){
      dept = await Department.findAll({
        where: {
          id: req.department
        }
      });
    }

    const accessType = await PermissionType.findAll({
      where: {
        id: req.permissionType[0]
      }
    });


    let notificationObjTemp = null;

    const superUsers = await getSuperUsers()
    const superUserEmails = superUsers.map(uc => uc.get({ plain: true })).map(item => item.email);
    

    if(permissions.length <= 0){
      const newPermission = await Permission.create({
        role_id : req.role,
        department_id : req.department == 0 ? null : req.department ,
        access_type_id : req.permissionType[0],
        screen_id : screen[0]?.id,
        created_at: getCurrentDateForDB(),
        created_by : req.updated_by,
        updated_at: getCurrentDateForDB(),
        updated_by: req.updated_by,
      });

      notificationObjTemp = {
          emails: [...superUserEmails, req.updated_by] || [],
          title: `New Permission Created`,
          body: `${req.updated_by} has created a new permission in ${system[0].name}. Screen Name -> ${req.screenName} / Role -> ${role[0].description} / Department -> ${dept && dept[0] ? dept[0].name : '-'} / Access Type -> ${accessType[0].type}`,      data: { 
          type: 'info',
          system: "User Module"
          },
      };

      // Log creation event
      try {
          const worker = new Worker(
              path.join(__dirname, '../workers/LogsCreateWorker.js'),
              {
                  workerData: {
                      action_taken: `CREATE by ${req.updated_by}`,
                      table_name: 'tbl_permissions',
                      column_name: 'All',
                      from_value: JSON.stringify({ name: "New Recoed. No Previous value" }),
                      to_value: JSON.stringify({ role_id : req.role,
                                  department_id : req.department == 0 ? null : req.department ,
                                  access_type_id : req.permissionType[0],
                                  screen_id : screen[0]?.id
                                 })
                  }
              }
          );
          worker.on('error', (logErr) => {
              logger.error('Permission creation log worker error:', logErr);
          });
          
      } catch (logErr) {
          logger.error('Permission creation log worker failed:', logErr);
      }
    }
    else{
      await Permission.update(
        {
          access_type_id : req.permissionType[0],
          updated_by: req.updated_by,
          updated_at: getCurrentDateForDB()
        },
        {
          where : {
            id : req.permissionId
          }
        }
      );

      notificationObjTemp = {
          emails: [...superUserEmails, req.updated_by] || [],
          title: `Permission Updated`,
          body: `${req.updated_by} has updated a permission in ${system[0].name}. Screen Name -> ${req.screenName} / Role -> ${role[0].description} / Department -> ${dept && dept[0] ? dept[0].name : '-'} / Access Type -> ${accessType[0].type}`,      data: { 
          type: 'info',
          system: "User Module"
          },
      };

            // Log creation event
      try {
          const worker = new Worker(
              path.join(__dirname, '../workers/LogsCreateWorker.js'),
              {
                  workerData: {
                      action_taken: `UPDATE by ${req.updated_by}`,
                      table_name: 'tbl_permissions',
                      column_name: 'All',
                      from_value: JSON.stringify(permissions[0]),
                      to_value: JSON.stringify({ role_id : req.role,
                                  department_id : req.department == 0 ? null : req.department ,
                                  access_type_id : req.permissionType[0],
                                  screen_id : screen[0]?.id
                                 })
                  }
              }
          );
          worker.on('error', (logErr) => {
              logger.error('Permission creation log worker error:', logErr);
          });
          
      } catch (logErr) {
          logger.error('Permission creation log worker failed:', logErr);
      }

    }

    //Send notification    
    if(notificationObjTemp){
      sendMessageToKafkaForNotification(notificationObjTemp).catch(error => {
          logger.error('Notification sending failed:', error);
      });
    }

    return "Success!";
  } catch (error) {
    throw new AppError(`Error updating permissions: ${error.message}` || "Error occured", error.statusCode || 400);
  }
};

const getAllPermissionTypes = async (req) => {
  try {
    const permissions = await PermissionType.findAll();

    return permissions;
  } catch (AppError) {
    throw new AppError(`Error fetching permissions: ${error.message}` || "Error occured", error.statusCode || 400);
  }
};

const getPermissionTypeByUserSystemScreen = async (user_id, system_id, screen_path) => {
  try{

    const user = await User.findAll({
      where : {
        id  : user_id
      },
      include : [
        {
          model : UserRole,
          include : [
            {
              model : Role,
              where : {
                system_id : system_id
              },
              include : [
                {
                  model : System
                }
              ]
            }
          ]
        },
        {
          model : UserDepartment,
          include : [
            {
              model : Department,
              where : {
                system_id : system_id
              },
              include : [
                {
                  model : System
                }
              ]
            }
          ]
        },
        {
          model : UserSystem,
          include : [
            {
              model : System,
              where : {
                id : system_id
              }
            }
          ]
        }
      ]
    });

    // Group roles and departments by system
    const rolesBySystem = {};
    const departmentsBySystem = {};

    user[0].UserRoles.forEach(userRole => {
        const systemName = userRole.Role.System.name;
        if (!rolesBySystem[systemName]) {
            rolesBySystem[systemName] = [];
        }
        rolesBySystem[systemName].push({ id: userRole.Role.id, role: userRole.Role.description });
    });

    user[0].UserDepartments.forEach(userDept => {
        const systemName = userDept.Department.System.name;
        if (!departmentsBySystem[systemName]) {
            departmentsBySystem[systemName] = [];
        }
        departmentsBySystem[systemName].push({ id: userDept.Department.id, department: userDept.Department.name });
    });

    // Fetch navigations for each system, role, and department combination
    const userNavigation = [];
    
    for (const systemName in rolesBySystem) {
        const roleIds = rolesBySystem[systemName].map(role => role.id);
        const deptIds = departmentsBySystem[systemName] ? departmentsBySystem[systemName].map(dept => dept.id) : [];

        const whereClause = {
            role_id: { [Sequelize.Op.in]: roleIds }
        };

        if (deptIds.length > 0) {
            whereClause.department_id = { [Sequelize.Op.in]: deptIds };
        }

        const navigations = await Permission.findAll({
            where: whereClause,
            include: [{
                model: PermissionType,
                attributes: ['type']
            },
            {
                model: Screen,
                where: { archived: 0 },
                attributes: ['name', 'code', 'category'],
                include: [{ model: System, attributes: ['name'] }]
            }],
        });

        userNavigation.push(...navigations.map(navigation => {
            return {
                id: navigation.id,
                category: navigation.Screen.category,
                screenName: navigation.Screen.name,
                screenCode: navigation.Screen.code,
                system: navigation.Screen.System.name,
                accessType: navigation.PermissionType.type
            };
        }));
    }

    // Filter unique navigations
    const uniqueNavigation = userNavigation.filter((screen, index, self) =>
        index === self.findIndex((s) => s.screenName === screen.screenName && s.system === screen.system)
    );

    const sendingNavigation = uniqueNavigation.find(item => item.screenCode == screen_path);
    

    return sendingNavigation;
  } catch (error) {
    throw new AppError(`Error fetching permissions: ${error.message}` || "Error occured", error.statusCode || 400);
  }
}

module.exports = {
  getAllPermissions,
  permissionsByRoleDept,
  savePermissions,
  getAllPermissionTypes,
  getPermissionTypeByUserSystemScreen
};
