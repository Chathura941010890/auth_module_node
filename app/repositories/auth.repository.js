const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { Sequelize } = require("sequelize");
const axios = require("axios");
const user = require("../models/user");
const UserRole = require("../models/userRole");
const Role = require("../models/role");
const UserCustomer = require("../models/userCustomer");
const Customer = require("../models/customer");
const UserDepartment = require("../models/userDepartments");
const Department = require("../models/department");
const SpecialFunction = require("../models/specialFunction");
const UserFactory = require("../models/userFactory");
const Factory = require("../models/factory");
const UserSystem = require("../models/userSystem");
const System = require("../models/system");
const UserFunction = require("../models/userSpecialFunction");
const Country = require("../models/country");
const Permissions = require("../models/permission");
const PermissionType = require("../models/permissionType");
const Screen = require("../models/screen");

const dotenv = require("dotenv");
dotenv.config();

const LoginAuditLog = require("../models/loginAuditLog");
// Helper to log audit events
async function logLoginAudit({
  userId = null,
  email = null,
  ip = null,
  eventType,
  details = null,
}) {
  try {
    await LoginAuditLog.create({
      user_id: userId,
      email,
      ip_address: ip,
      event_type: eventType,
      details,
      created_at: new Date(),
    });
  } catch (err) {
    console.error("Failed to log login audit event:", err);
  }
}

const {
  checkLoginRateLimit,
  recordLoginAttempt,
  clearFailedLogins,
  generateTokens,
  recordFailedLogin,
  SECURITY_CONFIG,
  getUserLockout,
} = require("../utils/authSecurityUtils.js");

const { registerDeviceTokensFCM } = require("../kafka/controller");
const DowntimeLogs = require("../models/downtimeLogs");
const { getCurrentDateForLogging } = require("../utils/dateUtils");
const UserCountry = require("../models/userCountry.js");
const { createUser } = require("./user.repository.js");

const getActiveDowntimeForSystem = async (systemUrl) => {
  try {
    const formattedDate = getCurrentDateForLogging();

    const results = await DowntimeLogs.findAll({
      include: [
        {
          model: System,
          where: {
            url: systemUrl,
            block_login_when_active_downtime: 1,
          },
        },
      ],
      where: {
        finished: 0,
        archived: 0,
        to_time: {
          [Sequelize.Op.gt]: formattedDate,
        },
      },
    });

    return results;
  } catch (error) {
    throw new Error(`Failed to fetch active downtime: ${error.message}`);
  }
};

const checkRefreshTokenEnabled = async (systemUrl) => {
  try {
    const results = await System.findAll({
      where: {
        url: systemUrl,
        refresh_token_enabled: 1,
      },
    });

    return results;
  } catch (error) {
    throw new Error(`Failed to fetch refresh token enabled: ${error.message}`);
  }
};

const checkAutoUserRegisterEnabled = async (systemUrl) => {
  try {
    const results = await System.findAll({
      where: {
        url: systemUrl,
        user_auto_register: 1,
      },
    });

    return results;
  } catch (error) {
    throw new Error(`Failed to fetch auto user reg enabled: ${error.message}`);
  }
};

const signIn = async (email, password, deviceToken, system, clientIp) => {
  try {

    if (system && system != "") {
      // Get downtime info using the current time
      const downtimeInfo = await getActiveDowntimeForSystem(system);

      if (downtimeInfo && downtimeInfo.length > 0) {
        throw new Error(
          `System temporarily unavailable: Scheduled maintenance in progress until ${downtimeInfo[0].to_time}. Login access will be restored once maintenance is complete. We apologize for any inconvenience.`
        );
      }
    }

    // Check rate limiting
    if (clientIp && clientIp != "") {
      try {
        await checkLoginRateLimit(clientIp);
      } catch (rateErr) {
        // Log rate limit exceeded event
        await logLoginAudit({
          email: email,
          ip: clientIp,
          eventType: "rate_limit_exceeded",
          details: rateErr.message,
        });
        throw new Error(
          "Your login attempts limit exceeded. Please contact system administrator!"
        );
      }
    }

    // First, check if user exists and get their SSO preference
    let userAvail = await user.findOne({
      where: {
        [Sequelize.Op.and]: [
          Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("email")),
            Sequelize.fn("LOWER", email)
          ),
          { is_active: 1 },
        ],
      },
    });

    if (!userAvail) {
      const autoRegEnabled = await checkAutoUserRegisterEnabled(system);

      const validated = await validateAzureCredentials(email, password, clientIp)

      if (autoRegEnabled.length > 0 && validated == "Success") {

        if(!autoRegEnabled[0].auto_register_default_role || autoRegEnabled[0].auto_register_default_role == 0){
          throw new Error('Automatic user registration default role not defined!')
        }

        const userData = {
          name: email,
          email,
          password,
          mobile_no: 77123456,
          created_by: `Automatic(${autoRegEnabled[0].name})`,
          updated_by: `Automatic(${autoRegEnabled[0].name})`,
          is_internal_user: 1,
          customerIds: [],
          countryIds: [1],
          roleIds: [autoRegEnabled[0].auto_register_default_role],
          departmentIds: [],
          factoryIds: [],
          functionIds: [],
          systemIds: [autoRegEnabled[0].id],
          sso_login_enabled: 1,
        };

        await createUser(userData);

       // Re-fetch the newly created user
        userAvail = await user.findOne({
          where: {
            [Sequelize.Op.and]: [
              Sequelize.where(
                Sequelize.fn("LOWER", Sequelize.col("email")),
                Sequelize.fn("LOWER", email)
              ),
              { is_active: 1 },
            ],
          },
        });
        
        if (!userAvail) {
          throw new Error("Failed to create user account. Please try again.");
        }

      } else {
        recordLoginAttempt(clientIp, false);

        await logLoginAudit({
          email: email,
          ip: clientIp,
          eventType: "user_not_found",
          details:
            "No ACTIVE user found for this email. (If email is correct please contact system admin)",
        });

        throw new Error(`User not found for email - ${email}`);
      }
    }

    // Check user's SSO login preference and route accordingly
    if (userAvail.sso_login_enabled == 1) {
      // User has SSO enabled - validate with Azure AD
      return await signInSSO(email, password, deviceToken, system, clientIp);
    } else {
      // User uses local authentication
      return await signInLocal(email, password, deviceToken, system, clientIp);
    }
  } catch (err) {
    console.log(err);
    throw new Error(err.message || "Error occured!");
  }
};

// Simple Azure AD credential validation using ROPC flow
const validateAzureCredentials = async (
  email,
  password,
  clientIp
) => {
  try {
    // Azure AD configuration
    const tenantId = process.env.AZURE_AD_TENANT_ID;
    const clientId = process.env.AZURE_AD_CLIENT_ID;
    const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
    const scope = "https://graph.microsoft.com/.default";
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    // Validate required environment variables
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error(
        "Azure AD configuration is incomplete. Please check environment variables."
      );
    }

    // Prepare request parameters for Azure AD token endpoint
    const params = new URLSearchParams();
    params.append("grant_type", "password");
    params.append("client_id", clientId);
    params.append("client_secret", clientSecret);
    params.append("scope", scope);
    params.append("username", email);
    params.append("password", password);

    let azureResponse;
    try {
      // Call Azure AD token endpoint to validate credentials
      azureResponse = await axios.post(tokenUrl, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        timeout: 10000,
      });
    } catch (azureError) {
      // Log failed SSO attempt with detailed error
      const errorDescription =
        azureError.response?.data?.message || azureError.message;
      await logLoginAudit({
        email,
        ip: clientIp,
        eventType: "sso_credentials_invalid",
        details: `Azure AD credential validation failed: ${errorDescription}`,
      });

      recordLoginAttempt(clientIp, false);

      // Return user-friendly error message
      if (azureError.response?.data?.error === "invalid_grant") {
        throw new Error(
          "Invalid username or password. Please check your Microsoft credentials."
        );
      }

      throw new Error(`Microsoft authentication failed: ${errorDescription}`);
    }

    // Check if Azure AD returned an access token (credentials are valid)
    if (!azureResponse.data || !azureResponse.data.access_token) {
      throw new Error("Microsoft authentication did not return a valid token");
    }

    return "Success";
  } catch (error) {
    // Log failed SSO attempt
    await logLoginAudit({
      email,
      ip: clientIp,
      eventType: "sso_login_failed",
      details: error.message,
    });

    throw new Error(`Azure AD authentication failed: ${error.message}`);
  }
};

//Making the response
const makeResponseObj = async (email, system, deviceToken, clientIp) => {
  try {
    // Credentials are valid in Azure AD, now check local user
    const UserCheck = await user.findOne({
      where: {
        [Sequelize.Op.and]: [
          Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("email")),
            Sequelize.fn("LOWER", email)
          ),
          { is_active: 1 },
        ],
      },
    });

    // Clear failed logins on successful credential validation
    await clearFailedLogins(UserCheck.id);

    // Get user details (excluding password)
    const User = await user.findOne({
      where: { id: UserCheck.id },
      attributes: { exclude: ["password"] },
    });

    // Fetch user roles, departments, customers, functions, factories, and systems
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

    const customers = await UserCustomer.findAll({
      where: { user_id: User.id },
      include: [
        { model: Customer, where: { archived: 0 }, attributes: ["id", "name"] },
      ],
    });

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

    const countries = await UserCountry.findAll({
      where: { user_id: User.id },
      include: [
        {
          model: Country,
          where: { archived: 0 },
          attributes: ["id", "name", "code"],
        },
      ],
    });

    const roleIds = roles.map((item) => item.role_id);
    const deptIds = departments.map((item) => item.department_id);

    // Get ALL permissions for user's roles and depts
    const allPermissions = await Permissions.findAll({
      attributes: [
        "id",
        "role_id",
        "department_id",
        "access_type_id",
        "screen_id",
      ],
      where: {
        role_id: {
          [Sequelize.Op.in]: roleIds,
        },
        [Sequelize.Op.or]: [
          { department_id: null },
          { department_id: { [Sequelize.Op.in]: deptIds } },
        ],
      },
      include: [
        {
          model: PermissionType,
          attributes: ["type"],
        },
        {
          model: Screen,
          where: {
            archived: 0,
          },
          attributes: [
            "name",
            "code",
            "category",
            "main_icon",
            "secondary_icon",
          ],
          include: [{ model: System, attributes: ["name"] }],
        },
      ],
    });

    const systemNames = new Set(systems.map((system) => system.System.name));

    // Define access type priority
    const ACCESS_TYPE_PRIORITY = {
      2: 1, // Highest priority (Read Write)
      1: 2, // Medium priority (Read Only)
      3: 3  // Lowest priority (Unauthorized)
    };

    // Process all permissions and keep highest priority access type for duplicates
    const permissionMap = new Map();

    allPermissions
      .filter(
        (permission) =>
          permission?.Screen?.System?.name &&
          permission?.PermissionType?.type &&
          systemNames.has(permission.Screen.System.name)
      )
      .forEach((permission) => {
        const processed = {
          id: permission.id,
          category: permission.Screen.category || "",
          screenName: permission.Screen.name,
          screenCode: permission.Screen.code,
          system: permission.Screen.System.name,
          accessType: permission.PermissionType.type,
          accessTypeId: permission.access_type_id,
          mainIcon: permission.Screen.main_icon || "",
          secIcon: permission.Screen.secondary_icon || "",
        };

        const key = `${processed.screenName}-${processed.screenCode}-${processed.system}`;
        
        // Check if this screen already exists
        const existing = permissionMap.get(key);
        
        if (!existing) {
          // First occurrence, add it
          permissionMap.set(key, processed);
        } else {
          // Compare priorities - keep the one with higher priority (lower priority number)
          const existingPriority = ACCESS_TYPE_PRIORITY[existing.accessTypeId] || 999;
          const newPriority = ACCESS_TYPE_PRIORITY[processed.accessTypeId] || 999;
          
          if (newPriority < existingPriority) {
            // New one has higher priority, replace
            permissionMap.set(key, processed);
          }
          // Otherwise keep existing
        }
    });

    // Convert map to array
    const uniqueNavigation = Array.from(permissionMap.values());

    // Prepare other user-related data
    const userRoles = roles.map((userRole) => ({
      id: userRole.Role.id,
      role: userRole.Role.description,
      system: userRole.Role.System.name,
    }));
    const userDepartments = departments.map((userDept) => ({
      id: userDept.Department.id,
      department: userDept.Department.name,
      system: userDept.Department.System.name,
    }));
    const userCustomers = customers.map((cus) => cus.Customer.name);
    const userCountries = countries.map((cus) => cus.Country.name);
    const userFunctions = functions.map((functionX) => ({
      function: functionX.SpecialFunction.name,
      system: functionX.SpecialFunction.System.name,
    }));
    const userFactories = factories.map((factory) => ({
      id: factory.Factory.id,
      factory: factory.Factory.name,
      system: factory.Factory.Country.name,
    }));

    const userSystems = systems.map((system) => ({
      system: system.System.name,
      url: system.System.url,
    }));

    // Handle device token registration
    if (
      deviceToken &&
      typeof deviceToken === "string" &&
      deviceToken.length > 0
    ) {
      try {
        await registerDeviceTokensFCM(User.id, deviceToken);
      } catch (deviceError) {
        console.warn("Device token registration failed:", deviceError.message);
      }
    }

    // Generate application tokens
    let token = null;
    const refreshTokenEnabled =
      system && system != "" ? await checkRefreshTokenEnabled(system) : [];

    if (refreshTokenEnabled && refreshTokenEnabled.length > 0) {
      const tokenPayload = {
        userId: User.id,
        email: User.email,
        loginTime: new Date().toISOString(),
        clientIp: clientIp,
      };

      const { accessToken, refreshToken, tokenId, expiresIn } =
        await generateTokens(tokenPayload, process.env.JWT_SECRET_KEY);

      // Log successful SSO login
      await logLoginAudit({
        userId: User.id,
        email,
        ip: clientIp,
        eventType: "sso_login_success",
        details: `Successful Azure AD credential validation for user: ${User.first_name} ${User.last_name}`,
      });

      return {
        status: "success",
        token: accessToken,
        refreshToken: refreshToken,
        tokenId: tokenId,
        expiresIn: expiresIn,
        user: User,
        roles: userRoles,
        departments: userDepartments,
        customers: userCustomers,
        countries: userCountries,
        functions: userFunctions,
        factories: userFactories,
        systems: userSystems,
        navigation: uniqueNavigation,
      };
    } else {
      token = jwt.sign(
        { userId: User.id, email: User.email },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "12h" }
      );

      // Log successful SSO login
      await logLoginAudit({
        userId: User.id,
        email,
        ip: clientIp,
        eventType: "sso_login_success",
        details: `Successful Azure AD credential validation for user: ${User.first_name} ${User.last_name}`,
      });

      return {
        status: "success",
        token,
        user: User,
        roles: userRoles,
        departments: userDepartments,
        customers: userCustomers,
        countries: userCountries,
        functions: userFunctions,
        factories: userFactories,
        systems: userSystems,
        navigation: uniqueNavigation,
      };
    }
  } catch (error) {
    throw new Error(`Error getting response data : ${error.message}`);
  }
};

// Updated SSO function - validates Azure AD credentials and returns local user data
const signInSSO = async (email, password, deviceToken, system, clientIp) => {
  const validated = await validateAzureCredentials(
    email,
    password,
    clientIp
  );

  if (validated === "Success") {
    return await makeResponseObj(email, system, deviceToken, clientIp);
  } else {
    throw new Error("Invalid Microsoft Credentials!");
  }
};

// Sign in without SSO
const signInLocal = async (email, password, deviceToken, system, clientIp) => {
  try {
    // Input validation
    if (!email || typeof email !== "string") {
      throw new Error("Email is required and must be a string");
    }

    if (!password || typeof password !== "string") {
      throw new Error("Password is required and must be a string");
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error("Invalid email format");
    }

    const UserCheck = await user.findOne({
      where: {
        [Sequelize.Op.and]: [
          Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("email")),
            Sequelize.fn("LOWER", email)
          ),
          { is_active: 1 },
        ],
      },
    });

    const passwordMatch = await bcrypt.compare(password, UserCheck.password);

    if (!passwordMatch) {
      recordLoginAttempt(clientIp, false);

      await logLoginAudit({
        userId: UserCheck.id,
        email: UserCheck.email,
        ip: clientIp,
        eventType: "wrong_password",
        details: "Wrong password entered.",
      });

      // Check failed login attempts for user (Redis)
      await recordFailedLogin(UserCheck.id);

      // Check if user should be deactivated in DB
      const lockout = await getUserLockout(UserCheck.id);
      if (
        lockout &&
        lockout.attempts === SECURITY_CONFIG.ACCOUNT_LOCKOUT.MAX_FAILED_ATTEMPTS
      ) {
        // Deactivate user in DB
        await user.update({ is_active: 0 }, { where: { id: UserCheck.id } });
        await logLoginAudit({
          userId: UserCheck.id,
          email: UserCheck.email,
          ip: clientIp,
          eventType: "user_deactivated",
          details: `User deactivated after ${SECURITY_CONFIG.ACCOUNT_LOCKOUT.MAX_FAILED_ATTEMPTS} failed login attempts.`,
        });
        throw new Error(
          `Your account has been blocked due to too many failed login attempts. Please contact your system administrator to reactivate your account.`
        );
      }

      throw new Error("Wrong password!");
    }

    if (UserCheck.has_password_changed === 0) {
      throw new Error("You need to change your password!");
    }

    // Clear failed login attempts on successful authentication
    recordLoginAttempt(clientIp, true);
    clearFailedLogins(UserCheck.id);

    return await makeResponseObj(email, system, deviceToken, clientIp);

  } catch (err) {
    console.log(err);
    throw new Error(err.message || "Error occured");
  }
};

const ssoCallback = async (email, password, deviceToken, system, clientIp) => {
  try {
    return true;
  } catch (err) {
    console.log(err);
    throw new Error(err.message || "Error occured in SSO Callback");
  }
};

const checkAccess = async (userId, pathName) => {
  let available = false;

  try {
    const roles = await UserRole.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Role,
          attributes: ["description", "id"],
          include: [{ model: System, attributes: ["name"] }],
        },
      ],
    });

    const depts = await UserDepartment.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Department,
          attributes: ["name", "id"],
          include: [{ model: System, attributes: ["name"] }],
        },
      ],
    });

    const roleIds = roles.map((userRole) => userRole.Role.id);
    const deptIds = depts.map((userDept) => userDept.Department.id);

    // Fixed permission query - same logic as signIn
    let whereClause = { role_id: { [Sequelize.Op.in]: roleIds } };

    if (deptIds.length > 0) {
      whereClause[Sequelize.Op.or] = [
        { department_id: null },
        { department_id: { [Sequelize.Op.in]: deptIds } },
      ];
    } else {
      whereClause.department_id = null;
    }

    const navigations = await Permissions.findAll({
      where: whereClause,
      include: [
        { model: PermissionType, attributes: ["type"] },
        {
          model: Screen,
          attributes: ["name", "code"],
          include: [{ model: System, attributes: ["name"] }],
        },
      ],
    });

    available = navigations.some(
      (navigation) => navigation.Screen.code === pathName.substring(1)
    );
  } catch (error) {
    console.error("Error in checkAccess:", error);
    available = false;
  }

  return available;
};

module.exports = {
  signIn,
  signInLocal,
  checkAccess,
  ssoCallback,
  signInSSO,
  validateAzureCredentials,
};
