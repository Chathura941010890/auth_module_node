const SpecialFunction = require("../models/specialFunction");
const System = require("../models/system")
const { getCurrentDateForDB } = require('../utils/dateUtils');
const { getAllUserDataByEmail } = require("../repositories/user.repository");
const logger = require('../utils/logger');
const { Worker } = require('worker_threads');
const path = require('path');

const { Sequelize } = require('sequelize');

const getAllSpecialFunctions = async () => {
    try {
        const specialFunctions = await SpecialFunction.findAll({
            include: [{
              model: System,
              attributes: ['id', 'name'], 
              as: 'System',
            }],
          });
          let specialFunctionsX = specialFunctions.map((specialFunction) => ({
            ...specialFunction.toJSON(),
            system: specialFunction.System ? specialFunction.System.name : null,
        }));
        return specialFunctionsX;;
    } catch (error) {
        throw new Error(`Error fetching special functions: ${error.message}`);
    }
}

async function createSpecialFunction(name, system_id, created_by) {

    try {
        const existingSpecialFunction = await SpecialFunction.findOne({
            where: {
                name: name
            }
        });

        if (existingSpecialFunction) {
            throw new Error('A special function with the same name already exists');
        }

        const newSpecialFunction = await SpecialFunction.create({
            name,
            system_id,
            created_at: getCurrentDateForDB(),
            created_by,
            updated_at: getCurrentDateForDB(),
            updated_by: created_by,
        });

                // Log creation event
        try {
            const worker = new Worker(
                path.join(__dirname, '../workers/LogsCreateWorker.js'),
                {
                    workerData: {
                        action_taken: `CREATE by ${created_by}`,
                        table_name: 'tbl_special_functions',
                        column_name: 'name,system_id',
                        from_value: JSON.stringify({ name: "New Recoed. No Previous value" }),
                        to_value: JSON.stringify({ name, system_id })
                    }
                }
            );
            worker.on('error', (logErr) => {
                logger.error('Function creation log worker error:', logErr);
            });
            
        } catch (logErr) {
            logger.error('Function creation log worker failed:', logErr);
        }

        return newSpecialFunction.toJSON();
    } catch (error) {
        throw new Error(`Error creating special function: ${error.message}`);
    }
}

async function updateSpecialFunction(updatedData) {
    try {
        updatedData.updated_at = getCurrentDateForDB();
        const specialFunctionToToggle = await SpecialFunction.findByPk(updatedData.id);

        if (!specialFunctionToToggle) {
            throw new Error('Special function not found');
        }

        if(updatedData.updated_by){
            const userData = await getAllUserDataByEmail(updatedData.updated_by);

            const systemHave = userData.UserSystems.find(item => item.System.id == specialFunctionToToggle.system_id);

            const isSuperAdmin = userData.UserRoles.find(item => item.Role.description == "BackofficeSuperAdmin");
            
            if(!isSuperAdmin && !systemHave){
                throw new Error(`Sorry! You do not have premissions to update data belongs to ${specialFunctionToToggle.name}.`)
            }
        }

        let oldValue = specialFunctionToToggle[updatedData.key];

        specialFunctionToToggle[updatedData.key] = updatedData.value;
        specialFunctionToToggle.updated_at = getCurrentDateForDB();
        specialFunctionToToggle.updated_by = updatedData.updated_by;

        await specialFunctionToToggle.save();

                // Log creation event
        try {
            const worker = new Worker(
                path.join(__dirname, '../workers/LogsCreateWorker.js'),
                {
                    workerData: {
                        action_taken: `UPDATE by ${updatedData.updated_by}`,
                        table_name: 'tbl_special_functions',
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

        return specialFunctionToToggle.toJSON();
    } catch (error) {
        throw new Error(`Error updating special function: ${error.message}`);
    }
}

async function archiveSpecialFunction(specialFunctionId, updated_by) {
    try {
        const specialFunctionToToggle = await SpecialFunction.findByPk(specialFunctionId);

        if (!specialFunctionToToggle) {
            throw new Error('Special function not found');
        }

        if(updated_by){
            const userData = await getAllUserDataByEmail(updated_by);

            const systemHave = userData.UserSystems.find(item => item.System.id == specialFunctionToToggle.system_id);

            const isSuperAdmin = userData.UserRoles.find(item => item.Role.description == "BackofficeSuperAdmin");
            
            if(!isSuperAdmin && !systemHave){
                throw new Error(`Sorry! You do not have premissions to update data belongs to ${specialFunctionToToggle.name}.`)
            }
        }

        specialFunctionToToggle.archived = specialFunctionToToggle.archived === 0 ? 1 : 0;
        specialFunctionToToggle.updated_at = getCurrentDateForDB();
        specialFunctionToToggle.updated_by = updated_by;

        await specialFunctionToToggle.save();

        return specialFunctionToToggle.toJSON();
    } catch (error) {
        throw new Error(`Error toggling archived status: ${error.message}`);
    }
}

module.exports = {
    getAllSpecialFunctions,
    createSpecialFunction,
    updateSpecialFunction,
    archiveSpecialFunction
};
