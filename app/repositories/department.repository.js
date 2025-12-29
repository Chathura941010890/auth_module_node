const Department = require("../models/department");
const System = require("../models/system")
const { Sequelize } = require('sequelize');
const { getCurrentDateForDB } = require('../utils/dateUtils');
const { getAllUserDataByEmail } = require("../repositories/user.repository");
const {  sendMessageToKafkaForNotification } = require('../kafka/controller.js');
const { getSuperUsers } = require("../services/userService.js");
const logger = require('../utils/logger');
const { Worker } = require('worker_threads');
const path = require('path');

const AppError = require('../utils/appError')

const getAllDepartments = async () => {
    try {
        const departments = await Department.findAll({
            include: [{
                model: System,
                attributes: ['id', 'name'],
                as: 'System',
            }],
            order: [
                [{ model: System, as: 'System' }, 'name', 'ASC'],
                ['name', 'ASC']
            ]
        });

        let departmentsX = departments.map((department) => ({
            ...department.toJSON(),
            system: department.System ? department.System.name : null,
        }));
        return departmentsX;
    } catch (error) {
        throw new AppError(`Error fetching departments: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

async function createDepartment(name, code, system_id, created_by) {

    try {
        const existingDepartment = await Department.findOne({
            where: {
                [Sequelize.Op.and]: [
                    { name: name },
                    { code: code },
                    { system_id: system_id }
                ]
            }
        });

        if (existingDepartment) {
            throw new AppError('A department with the same name or code for selected system already exists');
        }

        const newDepartment = await Department.create({
            name,
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
            body: `${created_by} has created a new department (${name}) in ${plainSystem[0].name || 'InqCloud'}`,      
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
                        table_name: 'tbl_departments',
                        column_name: 'name,code',
                        from_value: JSON.stringify({ name: "New Recoed. No Previous value" }),
                        to_value: JSON.stringify({ name, code })
                    }
                }
            );
            worker.on('error', (logErr) => {
                logger.error('Department creation log worker error:', logErr);
            });
            
        } catch (logErr) {
            logger.error('Department creation log worker failed:', logErr);
        }

        return newDepartment.toJSON();
    } catch (error) {
        throw new AppError(`Error creating department: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

async function updateDepartment(updatedData) {
    try {
        updatedData.updated_at = getCurrentDateForDB();
        const departmentToToggle = await Department.findByPk(updatedData.id);

        if (!departmentToToggle) {
            throw new AppError('Department not found', 400);
        }

        if(updatedData.updated_by){
            const userData = await getAllUserDataByEmail(updatedData.updated_by);

            const systemHave = userData.UserSystems.find(item => item.System.id == departmentToToggle.system_id);

            const isSuperAdmin = userData.UserRoles.find(item => item.Role.description == "BackofficeSuperAdmin");
            
            if(!isSuperAdmin && !systemHave){
                throw new Error(`Sorry! You do not have premissions to update data belongs to ${departmentToToggle.name}.`)
            }
        }

        let oldValue = departmentToToggle[updatedData.key];

        departmentToToggle[updatedData.key] = updatedData.value;
        departmentToToggle.updated_at = getCurrentDateForDB();
        departmentToToggle.updated_by = updatedData.updated_by;

        await departmentToToggle.save();

                // Log creation event
        try {
            const worker = new Worker(
                path.join(__dirname, '../workers/LogsCreateWorker.js'),
                {
                    workerData: {
                        action_taken: `UPDATE by ${updatedData.updated_by}`,
                        table_name: 'tbl_departments',
                        column_name: updatedData.key, 
                        from_value: JSON.stringify({ [updatedData.key]: oldValue }),
                        to_value: JSON.stringify({ [updatedData.key]: updatedData.value })
                    }
                }
            );
            worker.on('error', (logErr) => {
                logger.error('Dept creation log worker error:', logErr);
            });
            
        } catch (logErr) {
            logger.error('Dept creation log worker failed:', logErr);
        }

        return departmentToToggle.toJSON();
    } catch (error) {
        throw new AppError(`Error updating department: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

async function archiveDepartment(departmentId, updated_by) {
    try {
        const departmentToToggle = await Department.findByPk(departmentId);

        if (!departmentToToggle) {
            throw new AppError('Department not found', 400);
        }

         if(updated_by){
            const userData = await getAllUserDataByEmail(updated_by);

            const systemHave = userData.UserSystems.find(item => item.System.id == departmentToToggle.system_id);

            const isSuperAdmin = userData.UserRoles.find(item => item.Role.description == "BackofficeSuperAdmin");
            
            if(!isSuperAdmin && !systemHave){
                throw new Error(`Sorry! You do not have premissions to update data belongs to ${departmentToToggle.name}.`)
            }
        }

        departmentToToggle.archived = departmentToToggle.archived === 0 ? 1 : 0;
        departmentToToggle.updated_at = getCurrentDateForDB();
        departmentToToggle.updated_by = updated_by;

        await departmentToToggle.save();

        return departmentToToggle.toJSON();
    } catch (error) {
        throw new AppError(`Error toggling archived status: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

const getDepartmentsBySystem = async (systemName) => {
    try {
        const departments = await Department.findAll({
            include: [
                {
                    model: System,
                    where: { name: systemName },
                    attributes: ['id', 'name'],
                },
            ],
        });

        return departments.map((department) => ({
            ...department.toJSON(),
            system: department.System ? department.System.name : null,
        }));
    } catch (error) {
        throw new AppError(`Error fetching departments by system: ${error.message}` || "Error occurred", error.statusCode || 400);
    }
};

module.exports = {
    getAllDepartments,
    createDepartment,
    updateDepartment,
    archiveDepartment,
    getDepartmentsBySystem
};
