const Country = require("../models/country");
const { Sequelize } = require('sequelize');
const { getCurrentDateForDB } = require('../utils/dateUtils');
const {  sendMessageToKafkaForNotification } = require('../kafka/controller.js');

const logger = require('../utils/logger');
const { Worker } = require('worker_threads');
const path = require('path');

const AppError = require('../utils/appError');
const { getSuperUsers } = require("../services/userService.js");

const getAllCountries = async () => {
    try {
        const countries = await Country.findAll({
            order: [['name', 'ASC']]
        });
        return countries;
    } catch (error) {
        console.log(error);
        throw new AppError(error.message || "Error occured", error.statusCode || 400)
    }
}

async function createCountry(name, code, created_by) {

    try {
        const existingCountry = await Country.findOne({
            where: {
                [Sequelize.Op.or]: [
                    { name: name },
                    { code: code }
                ]
            }
        });

        if (existingCountry) {
            throw new AppError('A country with the same name or code already exists', 400);
        }

        const newCountry = await Country.create({
            name,
            code,
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
            body: `${created_by} has created a new country - ${name}`,      data: { 
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
                        table_name: 'tbl_countries',
                        column_name: 'name,code',
                        from_value: JSON.stringify({ name: "New Recoed. No Previous value" }),
                        to_value: JSON.stringify({ name, code })
                    }
                }
            );
            worker.on('error', (logErr) => {
                logger.error('Country creation log worker error:', logErr);
            });
            
        } catch (logErr) {
            logger.error('Country creation log worker failed:', logErr);
        }

        return newCountry.toJSON();
    } catch (error) {
        throw new AppError(`Error creating country: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

async function updateCountry(updatedData) {
    try {
        updatedData.updated_at = getCurrentDateForDB();
        const countryToToggle = await Country.findByPk(updatedData.id);

        if (!countryToToggle) {
            throw new AppError('Country not found', 400);
        }

        let oldValue = countryToToggle[updatedData.key];

        countryToToggle[updatedData.key] = updatedData.value;
        countryToToggle.updated_at = getCurrentDateForDB();
        countryToToggle.updated_by = updatedData.updated_by;

        await countryToToggle.save();

        // Log creation event
        try {
            const worker = new Worker(
                path.join(__dirname, '../workers/LogsCreateWorker.js'),
                {
                    workerData: {
                        action_taken: `UPDATE by ${updatedData.updated_by}`,
                        table_name: 'tbl_countries',
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

        return countryToToggle.toJSON();
    } catch (error) {
        throw new AppError(`Error updating country: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

async function archiveCountry(countryId, updated_by) {
    try {
        const countryToToggle = await Country.findByPk(countryId);

        if (!countryToToggle) {
            throw new AppError('Country not found', 400);
        }

        countryToToggle.archived = countryToToggle.archived === 0 ? 1 : 0;
        countryToToggle.updated_at = getCurrentDateForDB();
        countryToToggle.updated_by = updated_by;

        await countryToToggle.save();

        return countryToToggle.toJSON();
    } catch (error) {
        throw new AppError(`Error toggling archived status: ${error.message}` || "Error occured", error.statusCode || 400);
    }
}

module.exports = {
    getAllCountries,
    createCountry,
    updateCountry,
    archiveCountry
};
