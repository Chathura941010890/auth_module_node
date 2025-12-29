const Role = require("../models/role");
const System = require("../models/system")
const { getCurrentDateForDB } = require('../utils/dateUtils');
const {  sendMessageToKafkaForNotification } = require('../kafka/controller.js');
const { getSuperUsers } = require("../services/userService.js");
const logger = require('../utils/logger');
const { Worker } = require('worker_threads');
const path = require('path');

const { Sequelize } = require('sequelize');
const { getAllUserDataByEmail } = require("../repositories/user.repository");

const AppError = require('../utils/appError')

const getAllRoles = async () => {
    try {
        const roles = await Role.findAll({
            include: [{
              model: System,
              attributes: ['id', 'name'], 
              as: 'System',
            }],
            order: [
                [{ model: System, as: 'System' }, 'name', 'ASC'],
                ['description', 'ASC']
            ]
          });

          let rolesX = roles.map((role) => ({
            ...role.toJSON(),
            system: role.System ? role.System.name : null,
        }));
        return rolesX;
    } catch (error) {
        throw new AppError(`Error fetching roles: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

async function createRole(description, code, system_id, created_by) {

    try {
        const existingRole = await Role.findOne({
            where: {
                [Sequelize.Op.and]: [
                    { description: description },
                    { code: code },
                    { system_id: system_id }
                ]
            }
        });

        if (existingRole) {
            throw new AppError('A role with the same description or code already exists', 400);
        }

        const newRole = await Role.create({
            description,
            code,
            system_id,
            created_at: getCurrentDateForDB(),
            created_by,
            updated_at: getCurrentDateForDB(),
            updated_by: created_by,
        });

        const system = await System.findAll({
            where: {
                id: system_id
            },
            attributes: ['id', 'name']
        });

        const plainSystem = system.map(uc => uc.get({ plain: true }));

        const superUsers = await getSuperUsers()
        const superUserEmails = superUsers.map(uc => uc.get({ plain: true })).map(item => item.email);

        //Send notification
        const notificationObjTemp = {
           emails: [...superUserEmails, created_by] || [],
            title: `Master Data Creation`,
            body: `${created_by} has created a new role (${description}) in ${plainSystem[0].name || 'InqCloud'}`,      
            data: { 
                type: 'info',
                system: "User Module"
            },
        };

        sendMessageToKafkaForNotification(notificationObjTemp).catch(error => {
            logger.error('Notification sending failed:', error);
        });

        // Log creation event
        try {
            const worker = new Worker(
                path.join(__dirname, '../workers/LogsCreateWorker.js'),
                {
                    workerData: {
                        action_taken: `CREATE by ${created_by}`,
                        table_name: 'tbl_roles',
                        column_name: 'description,code,system_id',
                        from_value: JSON.stringify({ name: "New Recoed. No Previous value" }),
                        to_value: JSON.stringify({ description, code, system_id })
                    }
                }
            );
            worker.on('error', (logErr) => {
                logger.error('Role creation log worker error:', logErr);
            });
            
        } catch (logErr) {
            logger.error('Role creation log worker failed:', logErr);
        }

        return newRole.toJSON();
    } catch (error) {
        throw new AppError(`Error creating role: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

async function updateRole(updatedData) {
    try {
        updatedData.updated_at = getCurrentDateForDB();
        const roleToToggle = await Role.findByPk(updatedData.id);

        if (!roleToToggle) {
            throw new AppError('Role not found', 400);
        }

        if(updatedData.updated_by){
            const userData = await getAllUserDataByEmail(updatedData.updated_by);

            const systemHave = userData.UserSystems.find(item => item.System.id == roleToToggle.system_id);

            const isSuperAdmin = userData.UserRoles.find(item => item.Role.description == "BackofficeSuperAdmin");
            
            if(!isSuperAdmin && !systemHave){
                throw new Error(`Sorry! You do not have premissions to update data belongs to ${roleToToggle.description}.`)
            }
        }

        let oldValue = roleToToggle[updatedData.key];

        roleToToggle[updatedData.key] = updatedData.value;
        roleToToggle.updated_at = getCurrentDateForDB();
        roleToToggle.updated_by = updatedData.updated_by;

        await roleToToggle.save();

        return roleToToggle.toJSON();
    } catch (error) {
        throw new AppError(`Error updating role: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

async function archiveRole(roleId, updated_by) {
    try {
        const roleToToggle = await Role.findByPk(roleId);

        if (!roleToToggle) {
            throw new AppError('Role not found', error);
        }

        if(updated_by){
            const userData = await getAllUserDataByEmail(updated_by);

            const systemHave = userData.UserSystems.find(item => item.System.id == roleToToggle.system_id);

            const isSuperAdmin = userData.UserRoles.find(item => item.Role.description == "BackofficeSuperAdmin");
            
            if(!isSuperAdmin && !systemHave){
                throw new Error(`Sorry! You do not have premissions to update data belongs to ${roleToToggle.description}.`)
            }
        }

        roleToToggle.archived = roleToToggle.archived === 0 ? 1 : 0;
        roleToToggle.updated_at = getCurrentDateForDB();
        roleToToggle.updated_by = updated_by;

        await roleToToggle.save();

        return roleToToggle.toJSON();
    } catch (error) {
        throw new AppError(`Error toggling archived status: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

module.exports = {
    getAllRoles,
    createRole,
    updateRole,
    archiveRole
};
