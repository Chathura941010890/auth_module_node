const Customer = require("../models/customer");
const { Sequelize } = require('sequelize');
const { getCurrentDateForDB } = require('../utils/dateUtils');
const { safeJsonParse, safeJsonStringify } = require('../utils/jsonSecurityUtils');
const {  sendMessageToKafkaForNotification } = require('../kafka/controller.js');
const { getSuperUsers } = require("../services/userService.js");

const AppError = require('../utils/appError')
const logger = require('../utils/logger');

const { Worker } = require('worker_threads');
const path = require('path');

//redis
const { client } = require('../database/redisClient.js');

const getAllCustomers = async () => {
    try {

        const cacheKey = 'allCustomers';

        // Get data from the cache
        const cachedData = await client.get(cacheKey);

        if (cachedData) {
            try {
                return safeJsonParse(cachedData, { maxLength: 30000 });
            } catch (error) {
                logger.warn(`Failed to parse cached customer data safely: ${error.message}`);
                // Continue to fetch fresh data if cache is corrupted
            }
        }

        else{
             const customers = await Customer.findAll({
                order: [['name', 'ASC']]
            });

             try {
                 await client.set(cacheKey, safeJsonStringify(customers), { EX: 3600 });
             } catch (error) {
                 logger.warn(`Failed to cache customer data safely: ${error.message}`);
             }

            return customers;
        }

    } catch (error) {
        throw new AppError(`Error fetching customers: ${error.message}` || "Error occured", error.statusCode || 400);
    }
    finally {

    }
}

async function createCustomer(req) {
    const { name, code, created_by } = req.body;

    try {
        const existingCustomer = await Customer.findOne({
            where: {
                [Sequelize.Op.or]: [
                    { name: name },
                    { code: code }
                ]
            }
        });

        if (existingCustomer) {
            throw new AppError('A customer with the same name or code already exists' , 400);
        }

        const newCustomer = await Customer.create({
            name,
            code,
            created_at: getCurrentDateForDB(),
            created_by,
            updated_at: getCurrentDateForDB(),
            updated_by: created_by,
        });

        const cacheKey = 'allCustomers';

        await client.del(cacheKey);

        const superUsers = await getSuperUsers()
        const superUserEmails = superUsers.map(uc => uc.get({ plain: true })).map(item => item.email);

        //Send notification
        const notificationObjTemp = {
            emails: [...superUserEmails, created_by] || [],
            title: `Master Data Creation`,
            body: `${created_by} has created a new customer - ${name}`,      data: { 
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
                        table_name: 'tbl_customers',
                        column_name: 'name,code',
                        from_value: JSON.stringify({ name: "New Recoed. No Previous value" }),
                        to_value: JSON.stringify({ name, code })
                    }
                }
            );
            worker.on('error', (logErr) => {
                logger.error('Customer creation log worker error:', logErr);
            });
            
        } catch (logErr) {
            logger.error('Customer creation log worker failed:', logErr);
        }

        return newCustomer.toJSON();
    } catch (error) {
        throw new AppError(`Error creating customers: ${error.message}` || "Error occured", error.statusCode || 400);
    }
    finally {

    }
}

async function updateCustomer(updatedData) {
    try {
        updatedData.updated_at = getCurrentDateForDB();
        const customerToToggle = await Customer.findByPk(updatedData.id);

        if (!customerToToggle) {
            throw new AppError('Customer not found', 400);
        }
        
        let oldValue = customerToToggle[updatedData.key];

        customerToToggle[updatedData.key] = updatedData.value;
        customerToToggle.updated_at = getCurrentDateForDB();
        customerToToggle.updated_by = updatedData.updated_by;

        await customerToToggle.save();

        const cacheKey = 'allCustomers';

        await client.del(cacheKey);

        // Log creation event
        try {
            const worker = new Worker(
                path.join(__dirname, '../workers/LogsCreateWorker.js'),
                {
                    workerData: {
                        action_taken: `UPDATE by ${updatedData.updated_by}`,
                        table_name: 'tbl_customers',
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

        return customerToToggle.toJSON();
    } catch (error) {
        throw new AppError(`Error updating customers: ${error.message}` || "Error occured", error.statusCode || 400);
    }
    finally {
        
    }
}

async function getById(id){
    try{
        const cus = await Customer.findOne({
            where: {
                id : id
            }
        });

        if(!cus){
            throw new AppError("Not Found")
        }

        return cus;
    }
    catch(e){
        throw new AppError(e.message || "Internal server error")
    }
}

const getCustomersByIDs = async (ids) => {
    try {
        const Customer = require('../models/customer.js');
        const custmers = await Customer.findAll({
            where: { id: ids },
            attributes: ['id', 'name', 'code', 'created_at', 'updated_at', 'archived']
        });
        return custmers;
    } catch (error) {
        throw new Error(`Error fetching factories by IDs: ${error.message}`);
    }
};

module.exports = {
    getAllCustomers,
    createCustomer,
    updateCustomer,
    getById,
    getCustomersByIDs
};
