const AppError = require('../utils/appError');

/**
 * Validate email format
 */
const validateEmail = (email) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
};

/**
 * Validate password strength
 */
const validatePassword = (password) => {
    if (!password) {
        return { isValid: false, message: 'Password is required' };
    }
    
    if (password.length < 8) {
        return { isValid: false, message: 'Password must contain at least 8 characters' };
    }
    
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.*\d).+$/;
    if (!passwordRegex.test(password)) {
        return { 
            isValid: false, 
            message: 'Password must contain at least one uppercase letter, one special character, and one number' 
        };
    }
    
    return { isValid: true, message: 'Password is valid' };
};

/**
 * Validate user creation data
 */
const validateUserCreation = (userData) => {
    let errors = [];
    
    if (!userData.name) {
        errors.push('Name is required');
    }
    
    if (!userData.email) {
        errors.push('Email is required');
    } else if (!validateEmail(userData.email)) {
        errors.push('Valid email is required');
    }
    
    if (!userData.password) {
        errors.push('Password is required');
    } else {
        const passwordValidation = validatePassword(userData.password);
        if (!passwordValidation.isValid) {
            errors.push(passwordValidation.message);
        }
    }
    
    if (!userData.created_by || !userData.updated_by) {
        errors.push('Creator information is required');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

/**
 * Validate user update data
 */
const validateUserUpdate = (userData) => {
    const errors = [];
    
    if (!userData.userId) {
        errors.push('User ID is required for updating');
    }
    
    if (userData.email && !validateEmail(userData.email)) {
        errors.push('Valid email format required');
    }
    
    if (userData.password) {
        const passwordValidation = validatePassword(userData.password);
        if (!passwordValidation.isValid) {
            errors.push(passwordValidation.message);
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

/**
 * Validate pagination parameters
 */
const validatePagination = (page, pageSize) => {
    const errors = [];
    
    const pageNum = parseInt(page);
    const pageSizeNum = parseInt(pageSize);
    
    if (isNaN(pageNum) || pageNum < 1) {
        errors.push('Page must be a positive number');
    }
    
    if (isNaN(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 10000) {
        errors.push('Page size must be between 1 and 10000');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors,
        page: pageNum,
        pageSize: pageSizeNum
    };
};

module.exports = {
    validateEmail,
    validatePassword,
    validateUserCreation,
    validateUserUpdate,
    validatePagination
};
