
const userRepository = require('../repositories/user.repository');
const { validateUserCreation, validateUserUpdate, validatePagination } = require('../validators/userValidator');
const AppError = require('../utils/appError');

/**
 * User Service - Business logic layer
 */
class UserService {

    /**
     * Get all users with pagination
     */
    async getAllUsers(page = 1, pageSize = 10) {
        const validation = validatePagination(page, pageSize);
        if (!validation.isValid) {
            throw new AppError(`Validation failed: ${validation.errors.join(', ')}`, 400);
        }
        
        return await userRepository.getAllUsers(validation.page, validation.pageSize);
    }
    
    /**
     * Get all users with pagination for backoffice
     */
    async getAllUsersBackoffice(page = 1, pageSize = 10, usrCountryArr, usrSystemArr, userEmail) {
        const validation = validatePagination(page, pageSize);
        if (!validation.isValid) {
            throw new AppError(`Validation failed: ${validation.errors.join(', ')}`, 400);
        }
        
        return await userRepository.getAllUsersBackoffice(validation.page, validation.pageSize, usrCountryArr, usrSystemArr, userEmail);
    }
    
    /**
     * Create a new user
     */
    async createUser(userData) {
        const validation = validateUserCreation(userData);
        if (!validation.isValid) {
            throw new AppError(`Validation failed: ${validation.errors.join(', ')}`, 400);
        }
        
        return await userRepository.createUser(userData);
    }

    /**
     * Make password by user in first login!
     */
    async resetPasswordByUser(body) {

        const { token, email, password } = body;
        
        return await userRepository.resetPasswordByUser(token, email, password);
    }
    
    /**
     * Update existing user
     */
    async updateUser(userData) {
        const validation = validateUserUpdate(userData);
        if (!validation.isValid) {
            throw new AppError(`Validation failed: ${validation.errors.join(', ')}`, 400);
        }
        
        return await userRepository.updateUser(userData);
    }
    
    /**
     * Change user password
     */
    async changePassword(token, currentPassword, newPassword) {
        if (!token || !currentPassword || !newPassword) {
            throw new AppError('Token, current password, and new password are required', 400);
        }
        
        return await userRepository.changePassword(token, currentPassword, newPassword);
    }
    
    /**
     * Reset user password
     */
    async resetPassword(email, newPassword, resetBy, userEmail) {
        if (!email || !resetBy) {
            throw new AppError('Email and reset by are required', 400);
        }
        
        return await userRepository.resetUserPassword(email, newPassword, resetBy, userEmail);
    }
    
    /**
     * Get user by ID
     */
    async getUserById(userId) {
        if (!userId) {
            throw new AppError('User ID is required', 400);
        }
        
        return await userRepository.getUserDataByID(userId);
    }
    
    /**
     * Get user by Email
     */
    async getUserDataByEmail(userEmail) {
        if (!userEmail) {
            throw new AppError('User Email is required', 400);
        }
        
        return await userRepository.getUserDataByEmail(userEmail);
    }

        /**
     * Get user by Email Like
     */
    async getUserDataByEmailLike(userEmail) {
        if (!userEmail) {
            throw new AppError('User Email is required', 400);
        }
        
        return await userRepository.getUserDataByEmailLike(userEmail);
    }

    /**
     * Get users by customer
     */
    async getUsersByCustomer(customerName) {
        if (!customerName) {
            throw new AppError('Customer name is required', 400);
        }
        
        return await userRepository.getUsersByCustomer(customerName);
    }
    
    /**
     * Get users by department and system
     */
    async getUsersByDepartmentAndSystem(departmentName, systemName) {
        if (!departmentName || !systemName) {
            throw new AppError('Department and System are required', 400);
        }
        
        return await userRepository.getUsersByDepartmentAndSystem(departmentName, systemName);
    }
    
    /**
     * Get users by system and role
     */
    async getUsersBySystemAndRole(systemName, roleName) {
        if (!systemName) {
            throw new AppError('System is required', 400);
        }
        
        return await userRepository.getUsersBySystemAndRole(systemName, roleName);
    }
    
    /**
     * Get COE users
     */
    async getCOEUsers() {
        return await userRepository.getCOEUsers();
    }
    
    /**
     * Get user factory by user ID
     */
    async getUserFactory(userId) {
        if (!userId) {
            throw new AppError('User ID is required', 400);
        }
        
        return await userRepository.getUsersFactoryByUserID(userId);
    }
    
    /**
     * Get all user data by ID (with associations)
     */
    async getAllUserDataById(userId) {
        if (!userId) {
            throw new AppError('User ID is required', 400);
        }
        
        return await userRepository.getAllUserDataByID(userId);
    }

        /**
     * Get all user data by Email (with associations)
     */
    async getAllUserDataByEmail(email) {
        if (!email) {
            throw new AppError('User ID is required', 400);
        }
        
        return await userRepository.getAllUserDataByEmail(email);
    }
    
    /**
     * Get all users (raw query)
     */
    async getAllUsersRaw() {
        return await userRepository.getAllUsersFromRawQuery();
    }

    /**
     * Get multiple users by emails
     */
    async getUsersDataByEmails(emails) {
        if (!Array.isArray(emails) || emails.length === 0) {
            throw new AppError('No emails provided', 400);
        }
        return await userRepository.getUsersDataByEmails(emails);
    }


        /**
     * Get multiple users by IDs
     */

    async getUsersDataByIDs(ids) {
        if (!Array.isArray(ids) || ids.length === 0) {
            throw new AppError('No user IDs provided', 400);
        }
        return await userRepository.getUsersDataByIDs(ids);
    }

    /**
     * Get multiple users by emails
     */
    async getUsersDataByEmails(emails) {
        if (!Array.isArray(emails) || emails.length === 0) {
            throw new AppError('No emails provided', 400);
        }
        return await userRepository.getUsersDataByEmails(emails);
    }

        /**
     * Ask from super admin (for permissions)
     */
    async askFromSuperAdmin(superAdmins, fileds, message, userEmail) {
        if (!Array.isArray(superAdmins) || superAdmins.length === 0) {
            throw new AppError('No super admins provided', 400);
        }

        if (!Array.isArray(fileds) || fileds.length === 0) {
            throw new AppError('No fields provided', 400);
        }

        if (!message || message == "") {
            throw new AppError('No message provided', 400);
        }

        return await userRepository.askFromSuperAdmin(superAdmins, fileds, message, userEmail);
    }

    /**
     * Get users with BackofficeSuperAdmin role (role_id = 79)
     */
    async getSuperUsers() {
        return await userRepository.getSuperUsers();
    }
}

module.exports = new UserService();
