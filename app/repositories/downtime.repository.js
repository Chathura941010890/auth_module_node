const DowntimeLogs = require("../models/downtimeLogs");
const System = require("../models/system")
const { Sequelize } = require('sequelize');
const { getCurrentDateForDB } = require('../utils/dateUtils');
const sequelize = require("../database/index");


const createDowntime = async (system_id, from_time, to_time, reason = '', userName) => {
    const td = await sequelize.transaction();
    try{

        const selectedSystem = await System.findByPk(system_id);

        if(!selectedSystem){
            throw new Error("Invalid System Selected");
        }

        await DowntimeLogs.create({
          system_id: system_id,
          from_time: from_time,
          to_time: to_time,
          reason: reason,
          finished: 0,
          created_at: getCurrentDateForDB(),
          created_by: userName,
          updated_at: getCurrentDateForDB(),
          updated_by: userName
        }, { transaction: td });

        await td.commit();
        return "Success";
    }
    catch(e){
        await td.rollback();
        throw new Error(e.message || "Internal Server Error");
    }

}

const getAllDowntimes = async (page = 1, pageLimit = 50) => {
    try{
        // Parse to integers to ensure proper calculation
        const parsedPage = parseInt(page);
        const parsedLimit = parseInt(pageLimit);
        const offset = (parsedPage - 1) * parsedLimit;

        return await DowntimeLogs.findAndCountAll({
            offset: offset,
            limit: parsedLimit,
            order: [['id', 'DESC']],
            include: [
                { 
                    model: System,
                    attributes: ['name']
                }
            ]
        });
    }
    catch(e){
        throw new Error(e.message || "Internal Server Error");
    }
}

const updateDowntime = async (downtimeId, updateData, userName) => {
    const td = await sequelize.transaction();
    try {
        // Find the downtime log first
        const downtimeLog = await DowntimeLogs.findByPk(downtimeId);
        
        if (!downtimeLog) {
            throw new Error("Downtime log not found");
        }
        
        // Only allow updating finished and archived fields
        const allowedFields = {};
        
        if (updateData.hasOwnProperty('finished') && (updateData.finished == 0 || updateData.finished == 1)) {
            allowedFields.finished = updateData.finished;
        }
        
        if (updateData.hasOwnProperty('archived') && (updateData.archived == 0 || updateData.archived == 1)) {
            allowedFields.archived = updateData.archived;
        }
        
        // If no allowed fields to update, throw error
        if (Object.keys(allowedFields).length === 0) {
            throw new Error("No valid fields to update. Only 'finished' and 'archived' can be updated.");
        }
        
        // Add audit fields
        allowedFields.updated_at = getCurrentDateForDB();
        allowedFields.updated_by = userName;
        
        // Update the record
        await DowntimeLogs.update(allowedFields, {
            where: { id: downtimeId },
            transaction: td
        });
        
        await td.commit();
        return "Downtime updated successfully";
    } catch (e) {
        await td.rollback();
        throw new Error(e.message || "Failed to update downtime log");
    }
};

/**
 * Auto update finished status for downtime logs that have passed their end time
 * @returns {number} Number of records updated
 */
const updateCompletedDowntimes = async () => {
    const td = await sequelize.transaction();
    try {
        const currentDate = getCurrentDateForDB();
        
        // Find and update all downtime logs where to_time has passed but finished is still 0
        const [updatedCount] = await DowntimeLogs.update(
            {
                finished: 1,
                updated_at: currentDate,
                updated_by: 'SYSTEM'
            },
            {
                where: {
                    finished: 0,
                    archived: 0,
                    to_time: {
                        [Sequelize.Op.lt]: currentDate
                    }
                },
                transaction: td
            }
        );
        
        await td.commit();
        return updatedCount;
    } catch (e) {
        await td.rollback();
        throw new Error(`Failed to auto-update completed downtimes: ${e.message}`);
    }
};

/**
 * Get a single downtime by ID
 * @param {number} id - Downtime log ID
 * @returns {Object} Downtime log with system information
 */
const getDowntimeById = async (id) => {
    try {
        const downtime = await DowntimeLogs.findByPk(id, {
            include: [{ model: System, attributes: ['name', 'url'] }]
        });
        
        if (!downtime) {
            throw new Error("Downtime log not found");
        }
        
        return downtime;
    } catch (e) {
        throw new Error(e.message || "Failed to get downtime");
    }
};


module.exports = {
    createDowntime,
    getAllDowntimes,
    updateDowntime,
    updateCompletedDowntimes,
    getDowntimeById
}
