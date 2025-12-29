const { RESPONSE_STATUS } = require('../../constants');
const { getCurrentMoment, getCurrentDateISO } = require('../dateUtils');

/**
 * Format datetime to MySQL compatible format
 */
const formatDatetime = () => {
    const d = getCurrentMoment();
    return d.format('YYYY-MM-DD HH:mm:ss');
};

/**
 * Format success response
 */
const formatSuccessResponse = (data, message = 'Operation successful', total = null) => {
    const response = {
        status: RESPONSE_STATUS.SUCCESS,
        message,
        data
    };
    
    if (total !== null) {
        response.total = total;
    }
    
    return response;
};

/**
 * Format error response
 */
const formatErrorResponse = (message = 'Operation failed', statusCode = 400) => {
    return {
        status: RESPONSE_STATUS.FAILURE,
        message,
        statusCode,
        timestamp: getCurrentDateISO()
    };
};

/**
 * Format pagination metadata
 */
const formatPaginationMeta = (page, pageSize, total) => {
    return {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPrevPage: page > 1
    };
};

module.exports = {
    formatDatetime,
    formatSuccessResponse,
    formatErrorResponse,
    formatPaginationMeta
};
