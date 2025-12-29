const Screen = require("../models/screen");
const System = require("../models/system")
const { getCurrentDateForDB } = require('../utils/dateUtils');
const {  sendMessageToKafkaForNotification } = require('../kafka/controller.js');
const { getSuperUsers } = require("../services/userService.js");

const { Sequelize } = require('sequelize');
const { getAllUserDataByEmail } = require("../repositories/user.repository");
const logger = require('../utils/logger');
const { Worker } = require('worker_threads');
const path = require('path');

const AppError = require('../utils/appError')

const getAllScreens = async () => {
    try {
        const screens = await Screen.findAll({
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
          
          let screensX = screens.map((screen) => ({
            ...screen.toJSON(),
            system: screen.System ? screen.System.name : null,
        }));
        return screensX;
    } catch (error) {
        throw new AppError(`Error fetching screens: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

const getAllScreensBySystem = async (system_id) => {
    try {
        const screens = await Screen.findAll({
            where : {
                system_id : system_id
            },
            include: [{
              model: System,
              attributes: ['id', 'name'], 
              as: 'System',
            }],
          });
          let screensX = screens.map((screen) => ({
            ...screen.toJSON(),
            system: screen.System ? screen.System.name : null,
        }));
        return screensX;
    } catch (error) {
        throw new AppError(`Error fetching screens: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

async function createScreen(name, code, system_id, category, created_by, main_icon, secondary_icon) {
    
    try {
        const existingScreen = await Screen.findOne({
            where: {
                [Sequelize.Op.and]: [
                    { name: name },
                    { code: code },
                    { system_id: system_id }
                ]
            }
        });

        if (existingScreen) {
            throw new AppError('A screen with the same name or code already exists', 400);
        }

        const newScreen = await Screen.create({
            name,
            code,
            system_id,
            category,
            main_icon,
            secondary_icon,
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
            body: `${created_by} has created a new screen (${name}) in ${plainSystem[0].name || 'InqCloud'}`,      
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
                        table_name: 'tbl_screens',
                        column_name: 'All',
                        from_value: JSON.stringify({ name: "New Recoed. No Previous value" }),
                        to_value: JSON.stringify({ name,
                                            code,
                                            system_id,
                                            category,
                                            main_icon,
                                            secondary_icon })
                    }
                }
            );
            worker.on('error', (logErr) => {
                logger.error('Screen creation log worker error:', logErr);
            });
            
        } catch (logErr) {
            logger.error('Screen creation log worker failed:', logErr);
        }

        return newScreen.toJSON();
    } catch (error) {
        throw new AppError(`Error creating screen: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

async function updateScreen(updatedData) {
    try {
        updatedData.updated_at = getCurrentDateForDB();
        const screenToToggle = await Screen.findByPk(updatedData.id);

        if (!screenToToggle) {
            throw new AppError('Screen not found', 400);
        }

        if(updatedData.updated_by){
            const userData = await getAllUserDataByEmail(updatedData.updated_by);

            const systemHave = userData.UserSystems.find(item => item.System.id == screenToToggle.system_id);

            const isSuperAdmin = userData.UserRoles.find(item => item.Role.description == "BackofficeSuperAdmin");
            
            if(!isSuperAdmin && !systemHave){
                throw new Error(`Sorry! You do not have premissions to update data belongs to ${screenToToggle.name}.`)
            }
        }

        let oldValue = screenToToggle[updatedData.key];

        screenToToggle[updatedData.key] = updatedData.value;
        screenToToggle.updated_at = getCurrentDateForDB();
        screenToToggle.updated_by = updatedData.updated_by;

        await screenToToggle.save();

                // Log creation event
        try {
            const worker = new Worker(
                path.join(__dirname, '../workers/LogsCreateWorker.js'),
                {
                    workerData: {
                        action_taken: `UPDATE by ${updatedData.updated_by}`,
                        table_name: 'tbl_screens',
                        column_name: updatedData.key, 
                        from_value: JSON.stringify({ [updatedData.key]: oldValue }),
                        to_value: JSON.stringify({ [updatedData.key]: updatedData.value })
                    }
                }
            );
            worker.on('error', (logErr) => {
                logger.error('Customer creation log worker error:', logErr);
            });
            
        } catch (logErr) {
            logger.error('Customer creation log worker failed:', logErr);
        }

        return screenToToggle.toJSON();
    } catch (error) {
        throw new AppError(`Error updating screen: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

async function archiveScreen(screenId, updated_by) {
    try {
        const screenToToggle = await Screen.findByPk(screenId);

        if (!screenToToggle) {
            throw new AppError('Screen not found', 400);
        }

        if(updated_by){
            const userData = await getAllUserDataByEmail(updated_by);

            const systemHave = userData.UserSystems.find(item => item.System.id == screenToToggle.system_id);

            const isSuperAdmin = userData.UserRoles.find(item => item.Role.description == "BackofficeSuperAdmin");
            
            if(!isSuperAdmin && !systemHave){
                throw new Error(`Sorry! You do not have premissions to update data belongs to ${screenToToggle.name}.`)
            }
        }

        screenToToggle.archived = screenToToggle.archived === 0 ? 1 : 0;
        screenToToggle.updated_at = getCurrentDateForDB();
        screenToToggle.updated_by = updated_by;

        await screenToToggle.save();

        return screenToToggle.toJSON();
    } catch (error) {
        throw new AppError(`Error toggling archived status: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

module.exports = {
    getAllScreens,
    getAllScreensBySystem,
    createScreen,
    updateScreen,
    archiveScreen
};
