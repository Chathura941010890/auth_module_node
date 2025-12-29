const { HTTP_STATUS, RESPONSE_STATUS } = require('../../constants');
const { getCurrentDateISO } = require('../dateUtils');

/**
 * Standardized response formatter for all controllers
 * Maintains backward compatibility with existing API responses
 */

/**
 * Format success response - maintains existing response structure
 */
const formatSuccessResponse = (data, message = 'Operation successful', meta = null) => {
    const response = {
        status: RESPONSE_STATUS.SUCCESS,
        message,
        data
    };
    
    // Add pagination/meta info if provided
    if (meta) {
        Object.assign(response, meta);
    }
    
    return response;
};

/**
 * Format error response - maintains existing error structure
 */
const formatErrorResponse = (message = 'Operation failed', statusCode = 400) => {
    return {
        status: RESPONSE_STATUS.FAILURE,
        message,
        timestamp: getCurrentDateISO()
    };
};

/**
 * Format legacy response for backward compatibility
 * Some endpoints return different structures
 */
const formatLegacyResponse = (data, success = true, message = null) => {
    if (success) {
        return {
            success: true,
            data,
            ...(message && { message })
        };
    } else {
        return {
            success: false,
            message: message || 'Operation failed'
        };
    }
};

/**
 * Format simple data response (for endpoints that return data directly)
 */
const formatDataResponse = (data) => {
    return data;
};

/**
 * Send standardized success response
 */
const sendSuccessResponse = (res, data, message = 'Operation successful', statusCode = HTTP_STATUS.OK, meta = null) => {
    res.status(statusCode).json(formatSuccessResponse(data, message, meta));
};

/**
 * Send standardized error response
 */
const sendErrorResponse = (res, message = 'Operation failed', statusCode = HTTP_STATUS.BAD_REQUEST) => {
    res.status(statusCode).json(formatErrorResponse(message, statusCode));
};

/**
 * Send legacy format response for backward compatibility
 */
const sendLegacyResponse = (res, data, success = true, message = null, statusCode = HTTP_STATUS.OK) => {
    const responseStatusCode = success ? statusCode : HTTP_STATUS.BAD_REQUEST;
    res.status(responseStatusCode).json(formatLegacyResponse(data, success, message));
};

module.exports = {
    formatSuccessResponse,
    formatErrorResponse,
    formatLegacyResponse,
    formatDataResponse,
    sendSuccessResponse,
    sendErrorResponse,
    sendLegacyResponse
};
