const moment = require('moment-timezone');

// Set default timezone to Asia/Kolkata (Indian Standard Time)
const TIMEZONE = 'Asia/Kolkata';

/**
 * Get current date/time in Asia/Kolkata timezone
 * @returns {Date} JavaScript Date object in IST
 */
const getCurrentDate = () => {
    return moment().tz(TIMEZONE).toDate();
};

/**
 * Get current date/time as ISO string in Asia/Kolkata timezone
 * @returns {string} ISO string in IST
 */
const getCurrentDateISO = () => {
    return moment().tz(TIMEZONE).toISOString();
};

/**
 * Get current date/time formatted for database
 * @returns {Date} Date object for database operations
 */
const getCurrentDateForDB = () => {
    return moment().tz(TIMEZONE).toDate();
};

/**
 * Get formatted date string for logging
 * @returns {string} Formatted date string
 */
const getCurrentDateForLogging = () => {
    return moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
};

/**
 * Get moment instance with Asia/Kolkata timezone
 * @returns {moment.Moment} Moment instance in IST
 */
const getCurrentMoment = () => {
    return moment().tz(TIMEZONE);
};

module.exports = {
    getCurrentDate,
    getCurrentDateISO,
    getCurrentDateForDB,
    getCurrentDateForLogging,
    getCurrentMoment,
    TIMEZONE
};
