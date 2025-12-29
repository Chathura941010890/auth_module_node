/**
 * HTTP Status Codes
 */
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
};

/**
 * Response Status Messages
 */
const RESPONSE_STATUS = {
    SUCCESS: 'Success',
    FAILURE: 'Failure',
    ERROR: 'Error'
};

/**
 * Cache Configuration
 */
const CACHE_CONFIG = {
    DEFAULT_TTL: 3600, // 1 hour
    USER_DATA_TTL: 86400, // 24 hours
    PAGINATION_TTL: 3600, // 1 hour
    CUSTOMER_DATA_TTL: 7200 // 2 hours
};

/**
 * Pagination Limits
 */
const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 100000,
    MIN_PAGE_SIZE: 1
};

/**
 * Password Requirements
 */
const PASSWORD_REQUIREMENTS = {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_SPECIAL_CHAR: true,
    REQUIRE_NUMBER: true,
    REGEX: /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.*\d).+$/
};

/**
 * Email Configuration
 */
const EMAIL_CONFIG = {
    FROM_ADDRESS: 'noreply@inqube.com',
    SUBJECTS: {
        USER_CREATION: 'InqCloud - User Credentials',
        USER_UPDATE: 'InqCloud - User Updates',
        PASSWORD_CHANGE: 'InqCloud - Password Change',
        PASSWORD_RESET: 'InqCloud - Password Reset'
    }
};

/**
 * User Roles for COE
 */
const COE_ROLE_IDS = [1, 11, 12];

/**
 * Database Table Names
 */
const TABLE_NAMES = {
    USERS: 'tbl_users',
    USER_ROLES: 'tbl_user_roles',
    USER_CUSTOMERS: 'tbl_user_customers',
    USER_DEPARTMENTS: 'tbl_user_departments',
    USER_FACTORIES: 'tbl_user_factories',
    USER_SYSTEMS: 'tbl_user_systems',
    USER_FUNCTIONS: 'tbl_user_special_functions',
    ROLES: 'tbl_roles',
    CUSTOMERS: 'tbl_customers',
    DEPARTMENTS: 'tbl_departments',
    FACTORIES: 'tbl_factories',
    SYSTEMS: 'tbl_systems',
    SPECIAL_FUNCTIONS: 'tbl_special_functions'
};

/**
 * Common Error Messages
 */
const ERROR_MESSAGES = {
    VALIDATION: {
        REQUIRED_FIELD: (field) => `${field} is required`,
        INVALID_EMAIL: 'Valid email is required',
        INVALID_PASSWORD: 'Password does not meet requirements',
        USER_NOT_FOUND: 'User not found',
        USER_EXISTS: 'User already exists',
        INVALID_CREDENTIALS: 'Invalid credentials'
    },
    AUTH: {
        INVALID_TOKEN: 'Invalid or expired token',
        TOKEN_REQUIRED: 'Access token is required',
        API_KEY_REQUIRED: 'API key is required',
        INVALID_API_KEY: 'Invalid API key'
    },
    GENERAL: {
        INTERNAL_ERROR: 'Internal server error',
        NOT_FOUND: 'Resource not found',
        FORBIDDEN: 'Access forbidden'
    }
};

module.exports = {
    HTTP_STATUS,
    RESPONSE_STATUS,
    CACHE_CONFIG,
    PAGINATION,
    PASSWORD_REQUIREMENTS,
    EMAIL_CONFIG,
    COE_ROLE_IDS,
    TABLE_NAMES,
    ERROR_MESSAGES
};
