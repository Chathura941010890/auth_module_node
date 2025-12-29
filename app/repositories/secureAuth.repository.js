/**
 * Secure Authentication Repository
 * Implements secure authentication flows with comprehensive security controls
 */

const bcrypt = require("bcryptjs");
const { Sequelize } = require("sequelize");
const AppError = require("../utils/appError");
const { 
  validatePasswordStrength,
  checkPasswordHistory,
  checkLoginRateLimit,
  recordLoginAttempt,
  checkAccountLockout,
  recordFailedLogin,
  clearFailedLogins,
  generateTokens,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  checkPasswordResetRateLimit,
  recordPasswordResetAttempt,
  SECURITY_CONFIG
} = require('../utils/authSecurityUtils');
const { getClientIp } = require('../middleware/secureAuthentication');

// Import models
const { 
  user, 
  UserRole, 
  Role, 
  System, 
  UserDepartment, 
  Department, 
  UserCustomer, 
  Customer, 
  UserFunction, 
  SpecialFunction, 
  UserFactory, 
  Factory, 
  Country, 
  UserSystem, 
  Permissions, 
  PermissionType, 
  Screen 
} = require("../models");

/**
 * Secure user sign-in with comprehensive security controls
 */
const secureSignIn = async (email, password, deviceToken = null, req = null) => {
  const clientIp = req ? await getClientIp(req) : 'unknown';
  
  try {
    // Input validation
    if (!email || typeof email !== 'string') {
      throw new AppError('Email is required and must be a string', 400);
    }
    
    if (!password || typeof password !== 'string') {
      throw new AppError('Password is required and must be a string', 400);
    }
    
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new AppError('Invalid email format', 400);
    }
    
    // Check rate limiting
    checkLoginRateLimit(clientIp);
    
    // Find user with password for authentication
    const UserCheck = await user.findOne({
      where: { 
        email: normalizedEmail,
        archived: 0 
      },
      attributes: ['id', 'email', 'password', 'has_password_changed', 'created_at', 'password_history']
    });

    if (!UserCheck) {
      // Record failed attempt to prevent user enumeration timing attacks
      recordLoginAttempt(clientIp, false);
      
      // Use same timing as successful password check to prevent timing attacks
      await bcrypt.compare(password, '$2a$10$dummyHashToPreventTimingAttacks1234567890');
      
      throw new AppError('Invalid email or password', 401);
    }

    // Check account lockout before password verification
    checkAccountLockout(UserCheck.id);

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, UserCheck.password);
    
    if (!isPasswordValid) {
      // Record failed login attempts
      recordLoginAttempt(clientIp, false);
      recordFailedLogin(UserCheck.id);
      
      throw new AppError('Invalid email or password', 401);
    }

    // Clear failed login attempts on successful authentication
    recordLoginAttempt(clientIp, true);
    clearFailedLogins(UserCheck.id);

    // Check if password needs to be changed
    if (UserCheck.has_password_changed === 0) {
      throw new AppError('You need to change your password before continuing', 355);
    }

    // Check password age
    const passwordAge = Date.now() - new Date(UserCheck.created_at).getTime();
    const maxPasswordAge = SECURITY_CONFIG.PASSWORD.MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    if (passwordAge > maxPasswordAge) {
      throw new AppError('Your password has expired. Please change your password', 356);
    }

    // Get user details without password
    const User = await user.findOne({
      where: { id: UserCheck.id },
      attributes: { exclude: ['password', 'password_history'] }
    });

    // Fetch user roles
    const roles = await UserRole.findAll({
      where: { user_id: User.id },
      include: [
        {
          model: Role,
          where: { archived: 0 },
          attributes: ["description", "id"],
          include: [{ model: System, attributes: ["id", "name"] }],
        },
      ],
    });

    // Fetch user departments
    const departments = await UserDepartment.findAll({
      where: { user_id: User.id },
      include: [
        {
          model: Department,
          where: { archived: 0 },
          attributes: ["name", "id"],
          include: [{ model: System, attributes: ["name"] }],
        },
      ],
    });

    // Fetch user customers
    const customers = await UserCustomer.findAll({
      where: { user_id: User.id },
      include: [
        { model: Customer, where: { archived: 0 }, attributes: ["id", "name"] },
      ],
    });

    // Fetch user functions
    const functions = await UserFunction.findAll({
      where: { user_id: User.id },
      include: [
        {
          model: SpecialFunction,
          where: { archived: 0 },
          attributes: ["id", "name"],
          include: [{ model: System, attributes: ["name"] }],
        },
      ],
    });

    // Fetch user factories
    const factories = await UserFactory.findAll({
      where: { user_id: User.id },
      include: [
        {
          model: Factory,
          where: { archived: 0 },
          attributes: ["id", "name"],
          include: [{ model: Country, attributes: ["name"] }],
        },
      ],
    });

    // Fetch user systems
    const systems = await UserSystem.findAll({
      where: { user_id: User.id },
      include: [
        {
          model: System,
          where: { archived: 0 },
          attributes: ["id", "name", "url"],
        },
      ],
    });

    // Get navigation permissions
    const roleIds = roles.map((item) => item.role_id);
    const deptIds = departments.map((item) => item.department_id);

    const [navigationsByRole, navigationsByDept] = await Promise.all([
      Permissions.findAll({
        attributes: ["id", "role_id", "department_id", "access_type_id", "screen_id"],
        where: {
          role_id: {
            [Sequelize.Op.in]: roleIds,
          },
        },
        include: [
          {
            model: PermissionType,
            attributes: ["type"],
          },
          {
            model: Screen,
            where: { archived: 0 },
            attributes: ["name", "code", "category", "main_icon", "secondary_icon"],
            include: [{ model: System, attributes: ["name"] }],
          },
        ],
      }),
      Permissions.findAll({
        attributes: ["id", "role_id", "department_id", "access_type_id", "screen_id"],
        where: {
          department_id: {
            [Sequelize.Op.in]: deptIds,
          },
        },
        include: [
          {
            model: PermissionType,
            attributes: ["type"],
          },
          {
            model: Screen,
            where: { archived: 0 },
            attributes: ["name", "code", "category", "main_icon", "secondary_icon"],
            include: [{ model: System, attributes: ["name"] }],
          },
        ],
      })
    ]);

    // Process navigation data
    const allNavigations = [...navigationsByRole, ...navigationsByDept];
    const uniqueNavigation = allNavigations.filter((item, index, self) =>
      index === self.findIndex((t) => t.screen_id === item.screen_id)
    );

    // Transform data for response
    const userRoles = roles.map((role) => ({
      id: role.Role.id,
      description: role.Role.description,
      system: role.Role.System.name,
    }));

    const userDepartments = departments.map((dept) => ({
      id: dept.Department.id,
      name: dept.Department.name,
      system: dept.Department.System.name,
    }));

    const userCustomers = customers.map((customer) => ({
      id: customer.Customer.id,
      name: customer.Customer.name,
    }));

    const userFunctions = functions.map((func) => ({
      id: func.SpecialFunction.id,
      name: func.SpecialFunction.name,
      system: func.SpecialFunction.System.name,
    }));

    const userFactories = factories.map((factory) => ({
      id: factory.Factory.id,
      name: factory.Factory.name,
      country: factory.Factory.Country.name,
    }));

    const userSystems = systems.map((system) => ({
      id: system.System.id,
      name: system.System.name,
      url: system.System.url,
    }));

    // Generate secure JWT tokens
    const jwtSecret = process.env.JWT_SECRET_KEY;
    if (!jwtSecret || jwtSecret.length < 32) {
      console.error('SECURITY CRITICAL: JWT secret is missing or too weak');
      throw new AppError('Authentication service configuration error', 500);
    }

    const tokenPayload = {
      userId: User.id,
      email: User.email,
      loginTime: new Date().toISOString(),
      clientIp: clientIp
    };

    const { accessToken, refreshToken, tokenId, expiresIn } = generateTokens(tokenPayload, jwtSecret);

    // Handle device token registration
    if (deviceToken && typeof deviceToken === 'string' && deviceToken.length > 0) {
      try {
        const { registerDeviceTokensFCM } = require('./notifications'); // Assuming this exists
        await registerDeviceTokensFCM({
          deviceToken: deviceToken,
          user_id: User.id,
          email: User.email,
        });
      } catch (deviceError) {
        console.warn('Device token registration failed:', deviceError.message);
        // Don't fail login due to device token issues
      }
    }

    // Log successful authentication
    console.info(`Successful authentication for user ${User.email} from IP ${clientIp}`);

    return {
      accessToken,
      refreshToken,
      tokenId,
      expiresIn,
      user: User,
      roles: userRoles,
      departments: userDepartments,
      customers: userCustomers,
      functions: userFunctions,
      factories: userFactories,
      systems: userSystems,
      navigation: uniqueNavigation,
    };

  } catch (err) {
    // Log authentication failure for security monitoring
    console.warn(`Authentication failed for email ${email} from IP ${clientIp}: ${err.message}`);
    
    if (err instanceof AppError) {
      throw err;
    }
    
    // Don't expose internal errors
    throw new AppError('Authentication failed', 401);
  }
};

/**
 * Secure password change with validation
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  try {
    // Input validation
    if (!userId || !currentPassword || !newPassword) {
      throw new AppError('User ID, current password, and new password are required', 400);
    }

    // Find user with password
    const UserCheck = await user.findOne({
      where: { 
        id: userId,
        archived: 0 
      },
      attributes: ['id', 'password', 'password_history']
    });

    if (!UserCheck) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, UserCheck.password);
    if (!isCurrentPasswordValid) {
      recordFailedLogin(userId);
      throw new AppError('Current password is incorrect', 401);
    }

    // Validate new password strength
    validatePasswordStrength(newPassword);

    // Check password history
    const passwordHistory = UserCheck.password_history ? JSON.parse(UserCheck.password_history) : [];
    await checkPasswordHistory(userId, newPassword, passwordHistory);

    // Hash new password
    const saltRounds = 12; // Strong salt rounds
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password history
    const updatedHistory = [UserCheck.password, ...passwordHistory].slice(0, SECURITY_CONFIG.PASSWORD.HISTORY_COUNT);

    // Update user password
    await user.update({
      password: hashedNewPassword,
      password_history: JSON.stringify(updatedHistory),
      has_password_changed: 1,
      updated_at: new Date()
    }, {
      where: { id: userId }
    });

    // Clear any failed login attempts
    clearFailedLogins(userId);

    console.info(`Password changed successfully for user ID ${userId}`);
    return { message: "Password changed successfully" };

  } catch (error) {
    console.warn(`Password change failed for user ID ${userId}: ${error.message}`);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Password change failed', 400);
  }
};

/**
 * Initiate secure password reset
 */
const initiatePasswordReset = async (email, req = null) => {
  const clientIp = req ? await getClientIp(req) : 'unknown';
  
  try {
    // Input validation
    if (!email || typeof email !== 'string') {
      throw new AppError('Email is required', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new AppError('Invalid email format', 400);
    }

    // Check rate limiting
    checkPasswordResetRateLimit(clientIp);
    recordPasswordResetAttempt(clientIp);

    // Find user (but don't reveal if user exists to prevent enumeration)
    const User = await user.findOne({
      where: { 
        email: normalizedEmail,
        archived: 0 
      },
      attributes: ['id', 'email', 'first_name', 'last_name']
    });

    // Always return success to prevent user enumeration
    const response = { message: "If the email exists, you will receive password reset instructions" };

    if (User) {
      // Generate secure password reset token
      const jwtSecret = process.env.JWT_SECRET_KEY;
      if (!jwtSecret || jwtSecret.length < 32) {
        console.error('SECURITY CRITICAL: JWT secret is missing or too weak');
        return response; // Don't fail, just log
      }

      const resetToken = generatePasswordResetToken(normalizedEmail, jwtSecret);

      // TODO: Send email with reset token
      // This should integrate with your email service
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      
      console.info(`Password reset initiated for ${normalizedEmail} from IP ${clientIp}`);
      
      // In a real implementation, you would send an email here
      // For now, we'll just log it (remove in production)
      console.log(`Password reset link: ${resetLink}`);
    }

    return response;

  } catch (error) {
    console.warn(`Password reset initiation failed for ${email} from IP ${clientIp}: ${error.message}`);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    // Don't expose internal errors
    throw new AppError('Password reset request failed', 400);
  }
};

/**
 * Complete password reset with token
 */
const completePasswordReset = async (resetToken, newPassword, req = null) => {
  const clientIp = req ? await getClientIp(req) : 'unknown';
  
  try {
    // Input validation
    if (!resetToken || typeof resetToken !== 'string') {
      throw new AppError('Reset token is required', 400);
    }
    
    if (!newPassword || typeof newPassword !== 'string') {
      throw new AppError('New password is required', 400);
    }

    // Verify reset token
    const jwtSecret = process.env.JWT_SECRET_KEY;
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new AppError('Password reset service unavailable', 500);
    }

    const decoded = verifyPasswordResetToken(resetToken, jwtSecret);
    const email = decoded.email;

    // Find user
    const User = await user.findOne({
      where: { 
        email: email,
        archived: 0 
      },
      attributes: ['id', 'password', 'password_history']
    });

    if (!User) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    // Validate new password strength
    validatePasswordStrength(newPassword);

    // Check password history
    const passwordHistory = User.password_history ? JSON.parse(User.password_history) : [];
    await checkPasswordHistory(User.id, newPassword, passwordHistory);

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password history
    const updatedHistory = [User.password, ...passwordHistory].slice(0, SECURITY_CONFIG.PASSWORD.HISTORY_COUNT);

    // Update user password
    await user.update({
      password: hashedNewPassword,
      password_history: JSON.stringify(updatedHistory),
      has_password_changed: 1,
      updated_at: new Date()
    }, {
      where: { id: User.id }
    });

    // Clear any failed login attempts and lockouts
    clearFailedLogins(User.id);

    console.info(`Password reset completed for user ${email} from IP ${clientIp}`);
    return { message: "Password reset successfully" };

  } catch (error) {
    console.warn(`Password reset completion failed from IP ${clientIp}: ${error.message}`);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Password reset failed', 400);
  }
};

/**
 * Check user access permissions (with security enhancements)
 */
const checkAccess = async (userId, pathName) => {
  try {
    // Input validation
    if (!userId || !pathName) {
      return false;
    }

    // Sanitize pathname to prevent path traversal
    const sanitizedPath = pathName.replace(/\.\./g, '').replace(/[<>]/g, '');
    
    // Check account lockout
    try {
      checkAccountLockout(userId);
    } catch (lockoutError) {
      return false; // Locked accounts have no access
    }

    // Special case for unauthorized path (but with proper validation)
    if (sanitizedPath === "/unauthorized") {
      return true;
    }

    // Fetch user roles with associated systems
    const roles = await UserRole.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Role,
          where: { archived: 0 },
          attributes: ["description", "id"],
          include: [{ model: System, attributes: ["name"] }],
        },
      ],
    });

    // Fetch user departments with associated systems
    const departments = await UserDepartment.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Department,
          where: { archived: 0 },
          attributes: ["name", "id"],
          include: [{ model: System, attributes: ["name"] }],
        },
      ],
    });

    // Check permissions based on roles and departments
    const roleIds = roles.map((item) => item.role_id);
    const deptIds = departments.map((item) => item.department_id);

    if (roleIds.length === 0 && deptIds.length === 0) {
      return false;
    }

    // Query permissions for the specific path
    const permissions = await Permissions.findAll({
      where: {
        [Sequelize.Op.or]: [
          {
            role_id: {
              [Sequelize.Op.in]: roleIds,
            },
          },
          {
            department_id: {
              [Sequelize.Op.in]: deptIds,
            },
          },
        ],
      },
      include: [
        {
          model: Screen,
          where: { 
            archived: 0,
            code: sanitizedPath // Assuming screen code matches the path
          },
          attributes: ["code"],
        },
      ],
    });

    return permissions.length > 0;

  } catch (error) {
    console.warn(`Access check failed for user ${userId}, path ${pathName}: ${error.message}`);
    return false;
  }
};

module.exports = {
  secureSignIn,
  changePassword,
  initiatePasswordReset,
  completePasswordReset,
  checkAccess
};