const Country = require("../models/country");
const Factory = require("../models/factory");
const { Sequelize } = require('sequelize');
const { getCurrentDateForDB } = require('../utils/dateUtils');
const {  sendMessageToKafkaForNotification } = require('../kafka/controller.js');
const { getSuperUsers } = require("../services/userService.js");
const logger = require('../utils/logger');
const { Worker } = require('worker_threads');
const path = require('path');

const AppError = require('../utils/appError')

const getAllFactories = async () => {
    try {
        const factories = await Factory.findAll({
            include: [{
                model: Country,
                attributes: ['id', 'name'],
            }],
            order: [['name', 'ASC']]
        });

        let factoriesX = factories.map((department) => ({
            ...department.toJSON(),
            country: department.Country ? department.Country.name : null,
        }));
        return factoriesX;
    } catch (error) {
        throw new AppError(`Error fetching factories: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

const getFactoryByID = async (id) => {
    try {
        const factories = await Factory.findAll({
            where : {
                id : id
            }
        });

        let factoriesX = factories.map((f) => ({
            ...f.toJSON(),
            country: f.Country ? f.Country.name : null,
        }));
        return factoriesX;
    } catch (error) {
        throw new AppError(`Error fetching factories: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

async function createFactory(name, code, country_id, created_by) {

    try {
        const existingFactory = await Factory.findOne({
            where: {
                [Sequelize.Op.or]: [
                    { name: name },
                    { code: code }
                ]
            }
        });

        if (existingFactory) {
            throw new AppError('A factory with the same name or code already exists', 400);
        }

        const newFactory = await Factory.create({
            name,
            code,
            country_id,
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
            body: `${created_by} has created a new factory - ${name}`,      data: { 
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
                        table_name: 'tbl_factories',
                        column_name: 'name,code',
                        from_value: JSON.stringify({ name: "New Recoed. No Previous value" }),
                        to_value: JSON.stringify({ name, code })
                    }
                }
            );
            worker.on('error', (logErr) => {
                logger.error('Factory creation log worker error:', logErr);
            });
            
        } catch (logErr) {
            logger.error('Factory creation log worker failed:', logErr);
        }

        return newFactory.toJSON();
    } catch (error) {
        throw new AppError(`Error creating factory: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

async function updateFactory(updatedData) {
    try {
        updatedData.updated_at = getCurrentDateForDB();
        const factoryToToggle = await Factory.findByPk(updatedData.id);

        if (!factoryToToggle) {
            throw new AppError('Factory not found', 400);
        }

        let oldValue = factoryToToggle[updatedData.key];

        factoryToToggle[updatedData.key] = updatedData.value;
        factoryToToggle.updated_at = getCurrentDateForDB();
        factoryToToggle.updated_by = updatedData.updated_by;

        await factoryToToggle.save();

                // Log creation event
        try {
            const worker = new Worker(
                path.join(__dirname, '../workers/LogsCreateWorker.js'),
                {
                    workerData: {
                        action_taken: `UPDATE by ${updatedData.updated_by}`,
                        table_name: 'tbl_factories',
                        column_name: updatedData.key, 
                        from_value: JSON.stringify({ [updatedData.key]: oldValue }),
                        to_value: JSON.stringify({ [updatedData.key]: updatedData.value })
                    }
                }
            );
            worker.on('error', (logErr) => {
                logger.error('Factory creation log worker error:', logErr);
            });
            
        } catch (logErr) {
            logger.error('Factory creation log worker failed:', logErr);
        }

        return factoryToToggle.toJSON();
    } catch (error) {
        throw new AppError(`Error updating factory: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

async function archiveFactory(factoryId, updated_by) {
    try {
        const factoryToToggle = await Factory.findByPk(factoryId);

        if (!factoryToToggle) {
            throw new AppError('Factory not found', 400);
        }

        factoryToToggle.archived = factoryToToggle.archived === 0 ? 1 : 0;
        factoryToToggle.updated_at = getCurrentDateForDB();
        factoryToToggle.updated_by = updated_by;

        await factoryToToggle.save();

        return factoryToToggle.toJSON();
    } catch (error) {
        throw new AppError(`Error archived status: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}
// Fetch multiple factories by IDs
const getFactoriesByIDs = async (ids) => {
    try {
        const Factory = require('../models/factory');
        const factories = await Factory.findAll({
            where: { id: ids },
            attributes: ['id', 'name', 'code', 'country_id', 'created_at', 'updated_at', 'archived']
        });
        return factories;
    } catch (error) {
        throw new Error(`Error fetching factories by IDs: ${error.message}`);
    }
};

module.exports = {
    getAllFactories,
    getFactoryByID,
    createFactory,
    updateFactory,
    archiveFactory,
    getFactoriesByIDs
};
