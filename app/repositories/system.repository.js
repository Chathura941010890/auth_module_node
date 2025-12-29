const AppError = require("../utils/appError");
const System = require("../models/system");
const { Sequelize } = require('sequelize');
const { getCurrentDateForDB } = require('../utils/dateUtils');
const {  sendMessageToKafkaForNotification } = require('../kafka/controller.js');
const { getSuperUsers } = require("../services/userService.js");
const logger = require('../utils/logger');
const { Worker } = require('worker_threads');
const path = require('path');


const getAllSystems = async () => {
    try {
        const systems = await System.findAll({
            order: [['name', 'ASC']]
        });
        return systems;
    } catch (error) {
        throw new AppError(`Error fetching systems: ${error.message}`, error.statusCode || 400);
    }
}

async function createSystem(name, code, url, created_by) {

    try {

        const existingSystem = await System.findOne({
            where: {
                [Sequelize.Op.or]: [
                    { name: name },
                    { code: code },
                    { url: url }
                ]
            }
        });

        if (existingSystem) {
            throw new Error('A system with the same name, code, or URL already exists');
        }

        const newSystem = await System.create({
            name,
            code,
            url,
            created_at: getCurrentDateForDB(),
            created_by,
            updated_at: getCurrentDateForDB(),
            updated_by: created_by,
        });

        const superUsers = await getSuperUsers()
        const superUserEmails = superUsers.map(uc => uc.get({ plain: true })).map(item => item.email);

        //Send notification
        const notificationObjTemp = {
            emails: [...superUserEmails, created_by] || [],
            title: `Master Data Creation`,
            body: `${created_by} has created a new system - ${name} & URL - ${url}`,      data: { 
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
                        table_name: 'tbl_systems',
                        column_name: 'name,code,url',
                        from_value: JSON.stringify({ name: "New Recoed. No Previous value" }),
                        to_value: JSON.stringify({ name, code, url })
                    }
                }
            );
            worker.on('error', (logErr) => {
                logger.error('System creation log worker error:', logErr);
            });
            
        } catch (logErr) {
            logger.error('System creation log worker failed:', logErr);
        }

        return newSystem.toJSON();
    } catch (error) {
        throw new Error(`Error creating system: ${error.message}`);
    }
}

async function updateSystem(updatedData) {
    try {

        updatedData.updated_at = getCurrentDateForDB();
        const systemToToggle = await System.findByPk(updatedData.id);

        if (!systemToToggle) {
            throw new Error('System not found');
        }

        let oldValue = systemToToggle[updatedData.key];

        systemToToggle[updatedData.key] = updatedData.value;
        systemToToggle.updated_at = getCurrentDateForDB();
        systemToToggle.updated_by = updatedData.updated_by;

        await systemToToggle.save();

                // Log creation event
        try {
            const worker = new Worker(
                path.join(__dirname, '../workers/LogsCreateWorker.js'),
                {
                    workerData: {
                        action_taken: `UPDATE by ${updatedData.updated_by}`,
                        table_name: 'tbl_systems',
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

        return systemToToggle.toJSON();
    } catch (error) {
        throw new Error(`Error updating system: ${error.message}`);
    }
}

async function archiveSystem(systemId, updated_by) {
    try {
        const systemToToggle = await System.findByPk(systemId);

        if (!systemToToggle) {
            throw new Error('System not found');
        }

        systemToToggle.archived = systemToToggle.archived === 0 ? 1 : 0;
        systemToToggle.updated_at = getCurrentDateForDB();
        systemToToggle.updated_by = updated_by;

        await systemToToggle.save();

        return systemToToggle.toJSON();
    } catch (error) {
        throw new Error(`Error toggling archived status: ${error.message}`);
    }
}

module.exports = {
    getAllSystems,
    createSystem,
    updateSystem,
    archiveSystem
}
