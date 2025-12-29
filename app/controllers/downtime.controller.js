const repo = require('../repositories/downtime.repository');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/formatting/responseFormatter');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const DowntimeLogs = require('../models/downtimeLogs');
const System = require('../models/system');
const { Sequelize } = require('sequelize');
const { getCurrentDateForDB } = require('../utils/dateUtils');

/**
 * Create a new downtime record
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createDowntime = async (req, res) => {
    try {
        const { system_id, from_time, to_time, reason } = req.body;
        
        // Validation
        if (!system_id) {
            throw new AppError('System ID is required', 400);
        }
        
        if (!from_time) {
            throw new AppError('Start time is required', 400);
        }
        
        if (!to_time) {
            throw new AppError('End time is required', 400);
        }
        
        // Get username from JWT or request
        const userName = req.user?.name || 'System';
        
        const result = await repo.createDowntime(
            system_id, 
            from_time, 
            to_time, 
            reason || '', 
            userName
        );
        
        return sendSuccessResponse(res, 'Downtime scheduled successfully', result);
    } catch (error) {
        logger.error(`Error creating downtime: ${error.message}`);
        return sendErrorResponse(
            res, 
            error.message || 'Failed to create downtime', 
            error.statusCode || 500
        );
    }
};

/**
 * Get all downtime records with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllDowntimes = async (req, res) => {
    try {
        const page = parseInt(req.query.page || 1);
        const limit = parseInt(req.query.limit || 50);
        
        // Validate pagination parameters
        if (page < 1) {
            throw new AppError('Page number must be at least 1', 400);
        }
        
        if (limit < 1 || limit > 100) {
            throw new AppError('Limit must be between 1 and 100', 400);
        }
        
        const result = await repo.getAllDowntimes(page, limit);
        
        return sendSuccessResponse(res, {
            data: result.rows,
            total: result.count,
            page,
            limit,
            totalPages: Math.ceil(result.count / limit)
        });
    } catch (error) {
        logger.error(`Error fetching downtimes: ${error.message}`);
        return sendErrorResponse(
            res, 
            error.message || 'Failed to fetch downtimes', 
            error.statusCode || 500
        );
    }
};

/**
 * Update a downtime record
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateDowntime = async (req, res) => {
    try {
        const { id } = req.params;
        const { finished, archived, userName } = req.body;
        
        if (!id) {
            throw new AppError('Downtime ID is required', 400);
        }
                
        const result = await repo.updateDowntime(
            id,
            { finished, archived },
            userName
        );
        
        return sendSuccessResponse(res, 'Downtime updated successfully', result);
    } catch (error) {
        logger.error(`Error updating downtime: ${error.message}`);
        return sendErrorResponse(
            res, 
            error.message || 'Failed to update downtime', 
            error.statusCode || 500
        );
    }
};

/**
 * Auto-update completed downtimes
 * Used by system or admin to mark expired downtimes as finished
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateCompletedDowntimes = async (req, res) => {
    try {
        // Call the repository function
        const updatedCount = await repo.updateCompletedDowntimes();
        
        return sendSuccessResponse(res, 'Auto-updated completed downtimes', {
            updatedCount
        });
    } catch (error) {
        logger.error(`Error auto-updating downtimes: ${error.message}`);
        return sendErrorResponse(
            res, 
            error.message || 'Failed to auto-update downtimes', 
            error.statusCode || 500
        );
    }
};

/**
 * Get a single downtime by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDowntimeById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            throw new AppError('Downtime ID is required', 400);
        }
        
        const downtime = await repo.getDowntimeById(id);
        
        return sendSuccessResponse(res, 'Downtime retrieved successfully', downtime);
    } catch (error) {
        logger.error(`Error fetching downtime by ID: ${error.message}`);
        return sendErrorResponse(
            res, 
            error.message || 'Failed to fetch downtime', 
            error.statusCode || 500
        );
    }
};

module.exports = {
    createDowntime,
    getAllDowntimes,
    updateDowntime,
    updateCompletedDowntimes,
    getDowntimeById
};
