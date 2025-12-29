const bcrypt = require("bcrypt");
const { Sequelize } = require("sequelize");

const jwt = require("jsonwebtoken");
const {
  generatePasswordResetToken,
  verifyPasswordResetToken,
  validatePasswordStrength,
} = require("../utils/authSecurityUtils.js");

const user = require("../models/user");
const UserCustomer = require("../models/userCustomer");
const UserDepartment = require("../models/userDepartments");
const UserFactory = require("../models/userFactory");
const UserRole = require("../models/userRole");
const UserFunction = require("../models/userSpecialFunction");
const UserSystem = require("../models/userSystem");
const Department = require("../models/department.js");
const System = require("../models/system.js");
const Role = require("../models/role.js");
const Customer = require("../models/customer.js");
const Factory = require("../models/factory.js");
const SpecialFunction = require("../models/specialFunction.js");
const logger = require('../utils/logger');
const { Worker } = require('worker_threads');
const path = require('path');

const AppError = require("../utils/appError");
const util = require("../utils/utilFunctions");
const {
  buildSafeRedisKey,
  sanitizePaginationParams,
  sanitizeRedisPattern,
} = require("../utils/redisSecurityUtils");
const {
  safeJsonParse,
  safeJsonStringify,
} = require("../utils/jsonSecurityUtils");

const sequelize = require("../database/index.js");

//redis
const { client } = require("../database/redisClient.js");

const {
  sendMessageToKafkForEmail,
  sendMessageToKafkaForNotification,
} = require("../kafka/controller.js");
const User = require("../models/user");
const { getCurrentDateForDB } = require("../utils/dateUtils.js");
const UserCountry = require("../models/userCountry.js");
const Country = require("../models/country.js");
const {
  formatLegacyResponse,
} = require("../utils/formatting/responseFormatter.js");

// Store scheduled emails with their timeouts
const scheduledEmails = new Map();

const JWT_SECRET = process.env.JWT_SECRET_KEY || "user_module_jwt_secret_key";

const deletePaginatedCache = async (pattern) => {
  try {
    // Sanitize pattern to prevent injection
    const safePattern = sanitizeRedisPattern(pattern);
    const keys = await client.keys(safePattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    console.error("Error deleting paginated cache:", error);
    // Don't throw error for cache operations to prevent blocking main functionality
  }
};

const getAllUsers = async (page = 1, pageSize = 10) => {
  try {
    // Validate and sanitize pagination parameters
    const { safePage, safePageSize } = sanitizePaginationParams(page, pageSize);

    const offset = (safePage - 1) * safePageSize;
    const limit = safePageSize;

    const cacheKey = buildSafeRedisKey(
      "getAllUsers",
      "page",
      safePage,
      "pageSize",
      safePageSize
    );

    // Get data from the cache
    const cachedData = await client.get(cacheKey);

    if (cachedData) {
      try {
        return safeJsonParse(cachedData, { maxLength: 50000 });
      } catch (error) {
        logger.warn(`Failed to parse cached data safely: ${error.message}`);
        // Continue to fetch fresh data if cache is corrupted
      }
    }

    // Fetch only required columns and batch fetch related data
    const { rows: Users, count: total } = await user.findAndCountAll({
      offset,
      limit,
      attributes: [
        "id",
        "name",
        "email",
        "mobile_no",
        "is_active",
        "is_internal_user",
        "sso_login_enabled",
        "wfx_username",
      ], // Fetch only required columns
      order: [["email", "ASC"]],
    });

    // Batch fetch related data
    const userIds = Users.map((user) => user.id);

    const [roles, systems, departments, customers, factories, functions] =
      await Promise.all([
        UserRole.findAll({
          where: { user_id: userIds },
          attributes: ["user_id", "role_id"],
          include: [
            {
              model: Role,
              attributes: ["description", "id"],
              where: { archived: 0 },
            },
          ],
        }),
        UserSystem.findAll({
          where: { user_id: userIds },
          attributes: ["user_id", "system_id"],
          include: [
            {
              model: System,
              attributes: ["name", "id"],
              where: { archived: 0 },
            },
          ],
        }),
        UserDepartment.findAll({
          where: { user_id: userIds },
          attributes: ["user_id", "department_id"],
          include: [
            {
              model: Department,
              attributes: ["name", "id"],
              where: { archived: 0 },
            },
          ],
        }),
        UserCustomer.findAll({
          where: { user_id: userIds },
          attributes: ["user_id", "customer_id"],
          include: [
            {
              model: Customer,
              attributes: ["name", "id"],
              where: { archived: 0 },
            },
          ],
        }),
        UserFactory.findAll({
          where: { user_id: userIds },
          attributes: ["user_id", "factory_id"],
          include: [
            {
              model: Factory,
              attributes: ["name", "id"],
              where: { archived: 0 },
            },
          ],
        }),
        UserFunction.findAll({
          where: { user_id: userIds },
          attributes: ["user_id", "function_id"],
          include: [
            {
              model: SpecialFunction,
              attributes: ["name", "id"],
              where: { archived: 0 },
            },
          ],
        }),
      ]);

    // Map related data to users
    const userMap = Users.map((user) => {
      const userRoles = roles
        .filter((role) => role.user_id === user.id)
        .map((role) => role.Role.description);
      const userSystems = systems
        .filter((system) => system.user_id === user.id)
        .map((system) => system.System.name);
      const userDepartments = departments
        .filter((dept) => dept.user_id === user.id)
        .map((dept) => dept.Department.name);
      const userCustomers = customers
        .filter((cust) => cust.user_id === user.id)
        .map((cust) => cust.Customer.name);
      const userFactories = factories
        .filter((fact) => fact.user_id === user.id)
        .map((fact) => fact.Factory.name);
      const userFunctions = functions
        .filter((func) => func.user_id === user.id)
        .map((func) => func.SpecialFunction.name);

      return {
        ...user.toJSON(),
        UserRoles: userRoles,
        UserSystems: userSystems,
        UserDepartments: userDepartments,
        UserCustomers: userCustomers,
        UserFactories: userFactories,
        UserFunctions: userFunctions,
      };
    });

    const response = { data: userMap, total };
    try {
      await client.set(cacheKey, safeJsonStringify(response), { EX: 3600 }); // Cache for 1 hour
    } catch (error) {
      logger.warn(`Failed to cache user data safely: ${error.message}`);
      // Continue without caching if stringify fails
    }

    return response;
  } catch (error) {
    throw new AppError(
      `Error fetching users: ${error.message}`,
      error.statusCode || 400
    );
  }
};

const getAllUsersBackoffice = async (
  page = 1,
  pageSize = 10,
  usrCountryArr,
  usrSystemArr,
  userEmail
) => {
  try {
    // Validate and sanitize pagination parameters
    const { safePage, safePageSize } = sanitizePaginationParams(page, pageSize);

    const offset = (safePage - 1) * safePageSize;
    const limit = safePageSize;

    // Fetch only required columns and batch fetch related data
    // const { rows: Users, count: total }
    const Users = await user.findAll({
      offset,
      limit,
      attributes: [
        "id",
        "name",
        "email",
        "mobile_no",
        "is_active",
        "is_internal_user",
        "sso_login_enabled",
        "wfx_username",
        "is_internal_user",
      ], // Fetch only required columns
      order: [["email", "ASC"]],
      include: [
        {
          model: UserSystem,
          include: [
            {
              model: System,
              where: {
                name: {
                  [Sequelize.Op.in]: usrSystemArr,
                },
              },
            },
          ],
        },
        {
          model: UserCountry,
          include: [
            {
              model: Country,
              where: {
                name: {
                  [Sequelize.Op.in]: usrCountryArr,
                },
              },
            },
          ],
        },
      ],
    });

    const total = await user.findAll({
      attributes: [
        "id",
        "name",
        "email",
        "mobile_no",
        "is_active",
        "is_internal_user",
        "sso_login_enabled",
        "wfx_username",
        "is_internal_user",
      ], // Fetch only required columns
      order: [["email", "ASC"]],
      include: [
        {
          model: UserSystem,
          include: [
            {
              model: System,
              where: {
                name: {
                  [Sequelize.Op.in]: usrSystemArr,
                },
              },
            },
          ],
        },
        {
          model: UserCountry,
          include: [
            {
              model: Country,
              where: {
                name: {
                  [Sequelize.Op.in]: usrCountryArr,
                },
              },
            },
          ],
        },
      ],
    });

    // Batch fetch related data
    const userIds = Users.map((user) => user.id);

    const [
      roles,
      systems,
      departments,
      customers,
      factories,
      functions,
      countries,
    ] = await Promise.all([
      UserRole.findAll({
        where: { user_id: userIds },
        attributes: ["user_id", "role_id"],
        include: [
          {
            model: Role,
            attributes: ["description", "id"],
            where: { archived: 0 },
          },
        ],
      }),
      UserSystem.findAll({
        where: { user_id: userIds },
        attributes: ["user_id", "system_id"],
        include: [
          { model: System, attributes: ["name", "id"], where: { archived: 0 } },
        ],
      }),
      UserDepartment.findAll({
        where: { user_id: userIds },
        attributes: ["user_id", "department_id"],
        include: [
          {
            model: Department,
            attributes: ["name", "id"],
            where: { archived: 0 },
          },
        ],
      }),
      UserCustomer.findAll({
        where: { user_id: userIds },
        attributes: ["user_id", "customer_id"],
        include: [
          {
            model: Customer,
            attributes: ["name", "id"],
            where: { archived: 0 },
          },
        ],
      }),
      UserFactory.findAll({
        where: { user_id: userIds },
        attributes: ["user_id", "factory_id"],
        include: [
          {
            model: Factory,
            attributes: ["name", "id"],
            where: { archived: 0 },
          },
        ],
      }),
      UserFunction.findAll({
        where: { user_id: userIds },
        attributes: ["user_id", "function_id"],
        include: [
          {
            model: SpecialFunction,
            attributes: ["name", "id"],
            where: { archived: 0 },
          },
        ],
      }),
      UserCountry.findAll({
        where: { user_id: userIds },
        attributes: ["user_id", "country_id"],
        include: [
          {
            model: Country,
            attributes: ["name", "id"],
            where: { archived: 0 },
          },
        ],
      }),
    ]);

    // Map related data to users
    const userMap = Users.map((user) => {
      const userRoles = roles
        .filter((role) => role.user_id === user.id)
        .map((role) => role.Role.description);
      const userSystems = systems
        .filter((system) => system.user_id === user.id)
        .map((system) => system.System.name);
      const userDepartments = departments
        .filter((dept) => dept.user_id === user.id)
        .map((dept) => dept.Department.name);
      const userCustomers = customers
        .filter((cust) => cust.user_id === user.id)
        .map((cust) => cust.Customer.name);
      const userFactories = factories
        .filter((fact) => fact.user_id === user.id)
        .map((fact) => fact.Factory.name);
      const userFunctions = functions
        .filter((func) => func.user_id === user.id)
        .map((func) => func.SpecialFunction.name);
      const userCountries = countries
        .filter((func) => func.user_id === user.id)
        .map((func) => func.Country.name);

      return {
        ...user.toJSON(),
        UserRoles: userRoles,
        UserSystems: userSystems,
        UserDepartments: userDepartments,
        UserCustomers: userCustomers,
        UserFactories: userFactories,
        UserFunctions: userFunctions,
        UserCountries: userCountries,
      };
    });

    //Filter by http req created user's country
    // let filtered = userMap.filter(item =>
    //     item.UserCountries.some(country => usrCountryArr.includes(country))
    //   ).filter(item2 =>
    //     item2.UserSystems.some(system => usrSystemArr.includes(system))
    //   )

    const filteredResponse = {
      total: total.length,
      data: userMap,
    };

    return filteredResponse;
  } catch (error) {
    console.log(error);

    throw new AppError(
      `Error fetching users: ${error.message}`,
      error.statusCode || 400
    );
  }
};

const createUser = async (userData) => {
  // Use single transaction with timeout to prevent deadlocks
  const t = await sequelize.transaction({
    isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    autocommit: false,
    timeout: 30000, // 30 seconds timeout
  });

  try {
    if (!userData) {
      throw new Error("Empty data!");
    }

    const created_at = util.formatDatetime();
    const updated_at = util.formatDatetime();

    const {
      name,
      email,
      passwordR,
      mobile_no,
      created_by,
      updated_by,
      is_internal_user,
      customerIds: rawCustomerIds,
      countryIds: rawCountryIds,
      roleIds: rawRoleIds,
      departmentIds: rawDepartmentIds,
      factoryIds: rawFactoryIds,
      functionIds: rawFunctionIds,
      systemIds: rawSystemIds,
      sso_login_enabled = 1,
    } = userData;

    // Ensure arrays are defined to prevent crashes
    const customerIds = rawCustomerIds || [];
    const countryIds = rawCountryIds || [];
    const roleIds = rawRoleIds || [];
    const departmentIds = rawDepartmentIds || [];
    const factoryIds = rawFactoryIds || [];
    const functionIds = rawFunctionIds || [];
    const systemIds = rawSystemIds || [];

    let password = Math.random().toString(36).substring(2, 10) || passwordR;

    if (!name) {
      throw new Error("Name is required!");
    }

    if (!email) {
      throw new Error("Email is required!");
    }

    if (!password) {
      throw new Error("Password is required!");
    }

    if (!created_by || !updated_by) {
      throw new Error("Creation user is required!");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const existingUser = await user.findOne({
      where: Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("email")),
        Sequelize.fn("LOWER", email)
      ),
    });

    if (existingUser) {
      throw new Error("User already exists!");
    }

    const newUser = await user.create(
      {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        mobile_no,
        created_at,
        created_by,
        updated_at,
        updated_by,
        is_internal_user,
        sso_login_enabled,
        has_password_changed: sso_login_enabled == 1 ? 1 : 0,
      },
      { transaction: t }
    );

    const userId = newUser.get("id");

    // Create user associations in parallel
    await Promise.all([
      ...customerIds.map((element) =>
        UserCustomer.create(
          {
            user_id: userId,
            customer_id: element,
          },
          { transaction: t }
        )
      ),

      ...countryIds.map((element) =>
        UserCountry.create(
          {
            user_id: userId,
            country_id: element,
          },
          { transaction: t }
        )
      ),

      ...roleIds.map((element) =>
        UserRole.create(
          {
            user_id: userId,
            role_id: element,
          },
          { transaction: t }
        )
      ),

      ...departmentIds.map((element) =>
        UserDepartment.create(
          {
            user_id: userId,
            department_id: element,
          },
          { transaction: t }
        )
      ),

      ...factoryIds.map((element) =>
        UserFactory.create(
          {
            user_id: userId,
            factory_id: element,
          },
          { transaction: t }
        )
      ),

      ...functionIds.map((element) =>
        UserFunction.create(
          {
            user_id: userId,
            function_id: element,
          },
          { transaction: t }
        )
      ),

      ...systemIds.map((element) =>
        UserSystem.create(
          {
            user_id: userId,
            system_id: element,
          },
          { transaction: t }
        )
      ),
    ]);

    // Fetch system names only if systemIds exist
    let systemTable = "";
    let systemForEmail = "";

    if (systemIds && systemIds.length > 0) {
      const systems = await System.findAll({
        where: {
          id: {
            [Sequelize.Op.in]: systemIds,
          },
        },
        attributes: ["url", "name"],
      });

      systemForEmail = systems[0].url;

      systemTable = systems
        .map(
          (system) => `<tr><td>${system.name}</td><td>${system.url}</td></tr>`
        )
        .join("");
    } else {
      systemTable = '<tr><td colspan="2">No systems assigned</td></tr>';
    }

    const userModule = await System.findAll({
      where: {
        name: "User Module",
      },
    });

    // Generate JWT token for password reset link (expires in 55 mins)
    const token = jwt.sign({ email: newUser.get("email") }, JWT_SECRET, {
      expiresIn: "30m",
    });

    // Assume systems is available, fallback to empty string if not
    let resetUrl = "";
    if (
      Array.isArray(userModule) &&
      userModule.length > 0 &&
      userModule[0].url
    ) {
      resetUrl = `${userModule[0].url}/changePassword?token=${token}`;
    }

    let passwordInstruction = "";

  if (systemForEmail != "") {
    if (sso_login_enabled == 0) {
      // For non-SSO users, provide reset link with instructions
      passwordInstruction = `
        <p>Your one-time temporary password has been generated - ${password}</p>
        <p>For security reasons, you are required to change this temporary password before accessing InqCloud applications.</p>
        <p>Please click the link below to set a new password (link valid for 30 minutes):</p>
        <p><a href="${resetUrl}">Set a new password</a></p>
      `;
    } else {
      // For SSO users, use MS account credentials
      passwordInstruction = `<p><strong>Please use your Microsoft account credentials (same as your laptop login) to access the InqCloud applications.</strong></p>`;
    }
  }


    const emailObjTemp = {
      from: "noreply@inqube.com",
      to: [newUser.get("email")],
      cc: [],
      bcc: [],
      subject: "InqCloud - User Credentials",
      text: "Dear User,\n\n",
      html: `
      <p>New user account has been created for you to access InqCloud applications.</p>
      <p><strong>Username:</strong> ${newUser.get("email")}</p>
      ${passwordInstruction}
      <p><strong>Systems Accessible to You : </strong></p>
      <table border="1" cellpadding="5" cellspacing="0">
        <thead>
          <tr>
            <th>Name</th>
            <th>URL</th>
          </tr>
        </thead>
        <tbody>
          ${systemTable}
        </tbody>
      </table>
      <p>Best Regards,<br>InqApps</p>
    `,
    };

    // Send email asynchronously to avoid blocking
    sendMessageToKafkForEmail(emailObjTemp).catch((error) => {
      logger.error("Email sending failed:", error);
    });

    if (!created_by.includes("Auto")) {
      // Send app notification
      const notificationObjTemp = {
        emails: [created_by] || [],
        title: `New User Account Created`,
        body: `You have created a user account in inqcloud applications for ${newUser.get(
          "email"
        )}`,
        data: {
          type: "info",
          system: "User Module",
        },
      };

      sendMessageToKafkaForNotification(notificationObjTemp).catch((error) => {
        logger.error("Notification sending failed:", error);
      });

      // Log creation event
        try {
            const worker = new Worker(
                path.join(__dirname, '../workers/LogsCreateWorker.js'),
                {
                    workerData: {
                        action_taken: `CREATE by ${created_by}`,
                        table_name: 'tbl_users',
                        column_name: 'All',
                        from_value: JSON.stringify({ name: "New Recoed. No Previous value" }),
                        to_value: JSON.stringify(userData)
                    }
                }
            );
            worker.on('error', (logErr) => {
                logger.error('Customer creation log worker error:', logErr);
            });
            
        } catch (logErr) {
            logger.error('Customer creation log worker failed:', logErr);
        }

    }

    const superUsers = await getSuperUsers();
    const superUserEmails = superUsers
      .map((uc) => uc.get({ plain: true }))
      .map((item) => item.email);

    // Send app notification admins
    const notificationObjTempAdmin = {
      emails: superUserEmails || [],
      title: `New User Account Created`,
      body: `${
        created_by || "Anonymous"
      } have created the user account of ${newUser.get("email")}`,
      data: {
        type: "info",
        system: "User Module",
      },
    };

    sendMessageToKafkaForNotification(notificationObjTempAdmin).catch(
      (error) => {
        logger.error("Notification sending failed:", error);
      }
    );

    const cacheKey = "getAllUsers";
    client.del(cacheKey);

    // Invalidate all paginated cache entries
    await deletePaginatedCache("getAllUsers:page:*:pageSize:*");

    // Delete cache for each customer only if customerIds exist
    if (customerIds && customerIds.length > 0) {
      const customers = await Customer.findAll({
        where: {
          id: {
            [Sequelize.Op.in]: customerIds,
          },
        },
        attributes: ["name"],
      });

      // Delete cache for each customer
      for (const customer of customers) {
        const customerCacheKey = buildSafeRedisKey(
          "getUsersByCustomer",
          customer.name
        );
        await client.del(customerCacheKey);
      }
    }
    await t.commit();

    return { message: "User Created Successfully!" };
  } catch (error) {
    console.log(error);
    
    await t.rollback();
    throw new AppError(
      `Error creating user: ${error.message}`,
      error.statusCode || 400
    );
  }
};

const resetPasswordByUser = async (token, email, password) => {
  const t = await sequelize.transaction();
  try {
    const user = await User.findAll({
      where: {
        email: email,
        has_password_changed: 1,
      },
    });

    if (user && user.length > 0) {
      throw new Error(
        "You have already changed your password! If forgot plese contact a system admin."
      );
    }

    validatePasswordStrength(password);

    verifyPasswordResetToken(token, process.env.JWT_SECRET_KEY);

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.update(
      {
        password: hashedPassword,
        has_password_changed: 1,
        updated_at: getCurrentDateForDB(),
        updated_by: email,
      },
      {
        where: {
          email: email,
        },
        transaction: t,
      }
    );

    await t.commit();
    return "Success";
  } catch (err) {
    await t.rollback();
    console.log(err);
    throw new Error(err.message || "Internal server error!");
  }
};

const trackAssociationChanges = (
  existingAssociations,
  newIds,
  label,
  changes,
  idToNameMap,
  field
) => {
  const existingIds = existingAssociations.map((assoc) => assoc.get(field));
  const added = newIds.filter((id) => !existingIds.includes(id));

  if (added.length > 0) {
    changes.push(
      `${label} Added: ${added.map((id) => idToNameMap[id]).join(", ")}`
    );
  }
};

const updateAssociations = async (model, userId, ids, transaction, _column) => {
  if (ids && ids.length == 0) {
    await model.destroy({ where: { user_id: userId }, transaction });
  }
  if (ids && ids.length > 0) {
    await model.destroy({ where: { user_id: userId }, transaction });
    await Promise.all(
      ids.map(async (element) => {
        const associationData = { user_id: userId };
        associationData[_column] = element;

        await model.create(associationData, { transaction });
      })
    );
  }
};

const scheduleDelayedEmail = (userId, userEmail, changes, systems, updated_by) => {
  const emailData = {
    email: userEmail,
    changes: changes,
    systems: systems,
    lastUpdate: Date.now(),
    timeout: null,
  };

  // If there's already a scheduled email for this user, update it
  if (scheduledEmails.has(userId)) {
    const existing = scheduledEmails.get(userId);

    // Clear the existing timeout to prevent duplicate emails
    if (existing.timeout) {
      clearTimeout(existing.timeout);
    }

    // Merge changes (remove duplicates)
    const allChanges = [...existing.changes, ...changes];
    existing.changes = [...new Set(allChanges)]; // Remove duplicates
    existing.systems = systems; // Use latest systems
    existing.lastUpdate = Date.now();

    console.log(
      `Updated scheduled email for user ${userId}, total changes: ${existing.changes.length}`
    );
  } else {
    // Create new scheduled email
    scheduledEmails.set(userId, emailData);
    console.log(`Scheduled new email for user ${userId}`);
  }

  // Get the current email data (either existing or new)
  const currentEmailData = scheduledEmails.get(userId);

  // Set a new timeout for this user
  const timeoutId = setTimeout(async () => {
    try {
      const pendingEmail = scheduledEmails.get(userId);
      if (pendingEmail && pendingEmail.changes.length > 0) {
        console.log(
          `Sending delayed email to user ${userId} with ${pendingEmail.changes.length} changes`
        );

        const systemTable = pendingEmail.systems
          .map(
            (system) => `<tr><td>${system.name}</td><td>${system.url}</td></tr>`
          )
          .join("");

        const emailObjTemp = {
          from: "noreply@inqube.com",
          to: [pendingEmail.email],
          cc: [],
          bcc: [],
          subject: "InqCloud - User Updates",
          text: "Dear User,\n\n",
          html: `
            <p>Your user account has been updated for InqCloud applications.</p>
            <p>The following changes were made:</p>
            <ul>
              ${pendingEmail.changes
                .map((change) => `<li>${change}</li>`)
                .join("")}
            </ul>
            <p><strong>Updated Systems Accessible to You:</strong></p>
            <table border="1" cellpadding="5" cellspacing="0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>URL</th>
                </tr>
              </thead>
              <tbody>
                ${systemTable}
              </tbody>
            </table>
            <p>Please logout and login again to use the account changes.</p>
            <p>Best Regards,<br>InqApps</p>
          `,
        };

        await sendMessageToKafkForEmail(emailObjTemp);
        console.log(`Email sent successfully for user ${userId}`);
      }

      // Log creation event
        try {
            const worker = new Worker(
                path.join(__dirname, '../workers/LogsCreateWorker.js'),
                {
                    workerData: {
                        action_taken: `UPDATE by ${updated_by}`,
                        table_name: 'tbl_users',
                        column_name: 'All',
                        from_value: JSON.stringify({ name: "Update Record" }),
                        to_value: JSON.stringify({ changes: pendingEmail.changes.join(',') })
                    }
                }
            );
            worker.on('error', (logErr) => {
                logger.error('User update log worker error:', logErr);
            });
            
        } catch (logErr) {
            logger.error('User update log worker failed:', logErr);
        }

      // Remove from scheduled emails after sending (or if no changes)
      scheduledEmails.delete(userId);
    } catch (error) {
      console.error(`Error sending delayed email for user ${userId}:`, error);
      scheduledEmails.delete(userId); // Clean up on error
    }
  }, 5 * 60 * 1000); // 5 minutes

  // Store the timeout ID so we can clear it if needed
  currentEmailData.timeout = timeoutId;
};

const updateUser = async (userData) => {
  const t = await sequelize.transaction();

  try {
    const updated_at = util.formatDatetime();

    let {
      userId,
      name,
      email,
      mobile_no,
      wfx_username,
      updated_by,
      is_internal_user,
      sso_login_enabled,
      is_active,
      customerIds,
      roleIds,
      departmentIds,
      factoryIds,
      functionIds,
      systemIds,
      countryIds,
    } = userData;

    if (!userId) {
      throw new AppError("User ID is required for updating a user!", 400);
    }

    const existingUser = await user.findByPk(userId);

    if (!existingUser) {
      throw new AppError("User not found!", 404);
    }

    // Track changes
    const changes = [];
    if (mobile_no && mobile_no !== existingUser.mobile_no)
      changes.push(`Mobile No: ${existingUser.mobile_no} -> ${mobile_no}`);
    if (wfx_username && wfx_username !== existingUser.wfx_username)
      changes.push(
        `WFX Username: ${existingUser.wfx_username} -> ${wfx_username}`
      );
    if (is_active !== undefined && is_active !== existingUser.is_active)
      changes.push(`Active Status: ${existingUser.is_active} -> ${is_active}`);
    if (
      is_internal_user !== undefined &&
      is_internal_user !== existingUser.is_internal_user
    )
      changes.push(
        `Common User: ${existingUser.is_internal_user} -> ${is_internal_user}`
      );
    if (
      sso_login_enabled !== undefined &&
      sso_login_enabled !== existingUser.sso_login_enabled
    )
      changes.push(
        `SSO Login: ${existingUser.sso_login_enabled} -> ${sso_login_enabled}`
      );

    existingUser.name = name || existingUser.name;
    existingUser.email = email || existingUser.email;
    existingUser.mobile_no = mobile_no || existingUser.mobile_no;
    existingUser.wfx_username = wfx_username || existingUser.wfx_username;
    existingUser.is_active = is_active || existingUser.is_active;
    existingUser.updated_at = updated_at;
    existingUser.updated_by = updated_by || existingUser.updated_by;
    existingUser.is_internal_user =
      is_internal_user || existingUser.is_internal_user;
    existingUser.sso_login_enabled =
      sso_login_enabled || existingUser.sso_login_enabled;

    await existingUser.save({ transaction: t });

    const existingRoles = await UserRole.findAll({
      where: { user_id: userId },
    });
    const existingDepartments = await UserDepartment.findAll({
      where: { user_id: userId },
    });
    const existingCustomers = await UserCustomer.findAll({
      where: { user_id: userId },
    });
    const existingFactories = await UserFactory.findAll({
      where: { user_id: userId },
    });
    const existingFunctions = await UserFunction.findAll({
      where: { user_id: userId },
    });
    const existingCountries = await UserCountry.findAll({
      where: { user_id: userId },
    });

    if (roleIds) {
      const roles = await Role.findAll({
        where: { id: roleIds },
        attributes: ["id", "description"],
      });
      const idToNameMap = Object.fromEntries(
        roles.map((role) => [role.id, role.description])
      );
      trackAssociationChanges(
        existingRoles,
        roleIds,
        "Roles",
        changes,
        idToNameMap,
        "role_id"
      );
    }

    if (departmentIds) {
      const departments = await Department.findAll({
        where: { id: departmentIds },
        attributes: ["id", "name"],
      });
      const idToNameMap = Object.fromEntries(
        departments.map((dept) => [dept.id, dept.name])
      );
      trackAssociationChanges(
        existingDepartments,
        departmentIds,
        "Departments",
        changes,
        idToNameMap,
        "department_id"
      );
    }

    if (customerIds) {
      const customers = await Customer.findAll({
        where: { id: customerIds },
        attributes: ["id", "name"],
      });
      const idToNameMap = Object.fromEntries(
        customers.map((customer) => [customer.id, customer.name])
      );
      trackAssociationChanges(
        existingCustomers,
        customerIds,
        "Customers",
        changes,
        idToNameMap,
        "customer_id"
      );
    }

    if (countryIds) {
      const countries = await Country.findAll({
        where: { id: countryIds },
        attributes: ["id", "name"],
      });
      const idToNameMap = Object.fromEntries(
        countries.map((country) => [country.id, country.name])
      );
      trackAssociationChanges(
        existingCountries,
        countryIds,
        "Countries",
        changes,
        idToNameMap,
        "country_id"
      );
    }

    if (factoryIds) {
      const factories = await Factory.findAll({
        where: { id: factoryIds },
        attributes: ["id", "name"],
      });
      const idToNameMap = Object.fromEntries(
        factories.map((factory) => [factory.id, factory.name])
      );
      trackAssociationChanges(
        existingFactories,
        factoryIds,
        "Factories",
        changes,
        idToNameMap,
        "factory_id"
      );
    }

    if (functionIds) {
      const functions = await SpecialFunction.findAll({
        where: { id: functionIds },
        attributes: ["id", "name"],
      });
      const idToNameMap = Object.fromEntries(
        functions.map((func) => [func.id, func.name])
      );
      trackAssociationChanges(
        existingFunctions,
        functionIds,
        "Functions",
        changes,
        idToNameMap,
        "function_id"
      );
    }

    await Promise.all([
      updateAssociations(UserCustomer, userId, customerIds, t, "customer_id"),
      updateAssociations(UserCountry, userId, countryIds, t, "country_id"),
      updateAssociations(UserRole, userId, roleIds, t, "role_id"),
      updateAssociations(
        UserDepartment,
        userId,
        departmentIds,
        t,
        "department_id"
      ),
      updateAssociations(UserFactory, userId, factoryIds, t, "factory_id"),
      updateAssociations(UserFunction, userId, functionIds, t, "function_id"),
      updateAssociations(UserSystem, userId, systemIds, t, "system_id"),
    ]);

    const systemRecords = await UserSystem.findAll({
      where: { user_id: userId },
      transaction: t,
    });

    systemIds = systemRecords.map((system) => system.system_id);

    // Remove user roles that belong to systems the user no longer has access to
    if (systemIds && systemIds.length > 0) {
      // Get role IDs that belong to systems not assigned to the user using ORM
      const rolesToRemove = await UserRole.findAll({
        attributes: [["id", "user_role_id"]],
        where: {
          user_id: userId,
        },
        include: [
          {
            model: Role,
            attributes: [],
            where: {
              system_id: {
                [Sequelize.Op.notIn]: systemIds,
              },
            },
            required: true,
          },
        ],
        raw: true,
      });

      if (rolesToRemove.length > 0) {
        const userRoleIds = rolesToRemove.map((role) => role.user_role_id);
        await UserRole.destroy({
          where: {
            id: {
              [Sequelize.Op.in]: userRoleIds,
            },
          },
          transaction: t,
        });
        console.log(
          `Removed ${userRoleIds.length} roles not matching user's systems`
        );
      }

      // Get department IDs that belong to systems not assigned to the user using ORM
      const departmentsToRemove = await UserDepartment.findAll({
        attributes: [["id", "user_department_id"]],
        where: {
          user_id: userId,
        },
        include: [
          {
            model: Department,
            attributes: [],
            where: {
              system_id: {
                [Sequelize.Op.notIn]: systemIds,
              },
            },
            required: true,
          },
        ],
        raw: true,
      });

      if (departmentsToRemove.length > 0) {
        const userDepartmentIds = departmentsToRemove.map(
          (dept) => dept.user_department_id
        );
        await UserDepartment.destroy({
          where: {
            id: {
              [Sequelize.Op.in]: userDepartmentIds,
            },
          },
          transaction: t,
        });
        console.log(
          `Removed ${userDepartmentIds.length} departments not matching user's systems`
        );
      }
    } else {
      // If user has no systems, remove all their roles and departments
      await Promise.all([
        UserRole.destroy({
          where: { user_id: userId },
          transaction: t,
        }),
        UserDepartment.destroy({
          where: { user_id: userId },
          transaction: t,
        }),
      ]);
      console.log(`Removed all roles and departments for user with no systems`);
    }

    // Fetch system names
    const systems = await System.findAll({
      where: {
        id: {
          [Sequelize.Op.in]: systemIds,
        },
      },
      attributes: ["url", "name"],
    });

    // Instead of sending email immediately, schedule it for delayed sending
    if (changes.length > 0) {
      scheduleDelayedEmail(userId, existingUser.get("email"), changes, systems, updated_by);
      console.log(
        `Scheduled email for user ${userId} with ${changes.length} changes`
      );

      const superUsers = await getSuperUsers();
      const superUserEmails = superUsers
        .map((uc) => uc.get({ plain: true }))
        .map((item) => item.email);

      // Send app notification
      const notificationObjTempAdmin = {
        emails:
          [...superUserEmails, updated_by || existingUser.updated_by] || [],
        title: `User Account Update Notification`,
        body: `${
          updated_by || existingUser.updated_by || "Anonymous"
        } have updated the user account of ${existingUser.get("email")}`,
        data: {
          type: "info",
          system: "User Module",
        },
      };

      sendMessageToKafkaForNotification(notificationObjTempAdmin).catch(
        (error) => {
          logger.error("Notification sending failed:", error);
        }
      );
    }

    const cacheKey = "getAllUsers";
    client.del(cacheKey);

    // Invalidate all paginated cache entries
    await deletePaginatedCache("getAllUsers:page:*:pageSize:*");

    if (customerIds && Array.isArray(customerIds) && customerIds.length > 0) {
      const customers = await Customer.findAll({
        where: {
          id: {
            [Sequelize.Op.in]: customerIds,
          },
        },
        attributes: ["name"],
      });

      // Delete cache for each customer
      for (const customer of customers) {
        const customerCacheKey = buildSafeRedisKey(
          "getUsersByCustomer",
          customer.name
        );
        await client.del(customerCacheKey);
      }
    }

    // Invalidate getUserDataByID cache for this user
    const userDataCacheKey = buildSafeRedisKey("getUserDataByID", userId);
    await client.del(userDataCacheKey);

    await t.commit();

    return {
      message: "User Updated Successfully!",
      emailScheduled:
        changes.length > 0
          ? "Email notification scheduled for 5 minutes"
          : "No changes to notify",
    };
  } catch (error) {
    await t.rollback();
    console.log(error);

    throw new AppError(
      `Error updating user: ${error.message}`,
      error.statusCode || 400
    );
  }
};

// Add a cleanup function to handle server restart scenarios
const getScheduledEmailsStatus = () => {
  return {
    pendingEmails: scheduledEmails.size,
    userIds: Array.from(scheduledEmails.keys()),
  };
};

const changePassword = async (tokenReset, currentPassword, newPassword) => {
  const t = await sequelize.transaction();
  try {
    let token = tokenReset;
    // Verify JWT token locally
    const decoded = jwt.verify(token, JWT_SECRET);
    // Additional validation checks
    if (!decoded || !decoded.email || !decoded.exp || decoded.exp < Date.now() / 1000) {
      throw new AppError("Invalid Token!")
    }
    let email = decoded.email || "";
    const User = await user.findOne({ where: { email } });
    if (!User) {
      throw new AppError("User not found!", 400);
    }

    if(User.has_password_changed == 1){
      throw new AppError("You have already changed your password!", 400);
    }

    const passwordMatch = await bcrypt.compare(currentPassword, User.password);

    if (!passwordMatch) {
      throw new AppError("Wrong current password!", 401);
    }

    if (newPassword.length < 8) {
      throw new AppError("Password must contain at least 8 letters", 400);
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.*\d).+$/;

    if (!passwordRegex.test(newPassword)) {
      throw new AppError(
        "Password must contain at least one uppercase letter, one special character, and one number.",
        400
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedData = {
      password: hashedPassword,
      has_password_changed: 1,
    };

    const updateConditions = {
      email: email,
    };

    await User.update(updatedData, {
      where: updateConditions,
      transaction: t,
    });

    const emailObjTemp = {
      from: "noreply@inqube.com",
      to: [User.get("email")],
      cc: [],
      bcc: [],
      subject: "InqCloud - Password Change",
      text: "Dear User,\n\n",
      html: `<html>
        <body style="font-family: Arial, sans-serif; color: #222;">
          <p>Dear User,</p>
          <p>
            Your initial password has been <strong>successfully changed</strong> to a new one during your first login to <strong>InqCloud Applications</strong>.
          </p>
          <p>
            If you did not perform this action, please contact your administrator immediately.
          </p>
          <br>
          <p>Best Regards,<br>InqApps</p>
        </body>
      </html>`,
    };

    await sendMessageToKafkForEmail(emailObjTemp);

    //Send notification
    const notificationObjTemp = {
      emails: [User.get("email")] || [],
      title: `Password Change`,
      body: `You have changed your password successfully!`,
      data: {
        type: "info",
        system: "User Module",
      },
    };

    sendMessageToKafkaForNotification(notificationObjTemp).catch((error) => {
      logger.error("Notification sending failed:", error);
    });

    // Log creation event
    try {
        const worker = new Worker(
            path.join(__dirname, '../workers/LogsCreateWorker.js'),
            {
                workerData: {
                    action_taken: `CHANGED by ${User.get("email")} of ${email}`,
                    table_name: 'tbl_users',
                    column_name: 'password',
                    from_value: JSON.stringify({ name: "Hidden for security" }),
                    to_value: JSON.stringify({ name: "Hidden for security" })
                }
            }
        );
        worker.on('error', (logErr) => {
            logger.error('Customer creation log worker error:', logErr);
        });
        
    } catch (logErr) {
        logger.error('Customer creation log worker failed:', logErr);
    }

    const userSystems = await UserSystem.findAll({
      where: {
        user_id : User.get('id')
      },
      include: [
        {
          model: System
        }
      ]
    })

    await t.commit();
    return { message: "Password Changed Successfully!", data: userSystems };
  } catch (error) {
    await t.rollback();
    throw new AppError(
      `Error changing password: ${error.message}`,
      error.statusCode || 400
    );
  }
};

const getUsersByDepartmentAndSystem = async (departmentName, systemName) => {
  try {
    if (!departmentName || !systemName) {
      throw new AppError("Department and System names are required!", 400);
    }

    // Sanitize inputs
    const safeDepartmentName = departmentName.trim();
    const safeSystemName = systemName.trim();

    if (!safeDepartmentName || !safeSystemName) {
      throw new AppError("Department and System names cannot be empty!", 400);
    }

    // Build cache key
    const cacheKey = buildSafeRedisKey(
      "getUsersByDepartmentAndSystem",
      safeDepartmentName,
      safeSystemName
    );

    // Check cache first
    const cachedData = await client.get(cacheKey);
    if (cachedData) {
      try {
        return safeJsonParse(cachedData, { maxLength: 100000 });
      } catch (error) {
        logger.warn(
          `Failed to parse cached department-system users data: ${error.message}`
        );
      }
    }

    const users = await user.findAll({
      attributes: { exclude: ["password"] },
      include: [
        {
          model: UserDepartment,
          attributes: ["department_id"],
          include: [
            {
              model: Department,
              where: {
                name: safeDepartmentName,
                archived: 0,
              },
              attributes: ["name", "system_id"],
              include: [
                {
                  model: System,
                  where: {
                    name: safeSystemName,
                    archived: 0,
                  },
                  attributes: ["name"],
                },
              ],
            },
          ],
          required: true,
        },
        {
          model: UserRole,
          attributes: ["role_id"],
          include: [
            {
              model: Role,
              attributes: ["description"],
              where: { archived: 0 },
              include: [
                {
                  model: System,
                  where: {
                    name: safeSystemName,
                    archived: 0,
                  },
                  attributes: ["name"],
                },
              ],
              required: true,
            },
          ],
          required: false, // Make roles optional - user might have department access without specific roles
        },
      ],
      where: {
        is_active: 1,
      },
      order: [["email", "ASC"]],
    });

    // Cache the results for 30 minutes
    try {
      await client.set(cacheKey, safeJsonStringify(users), { EX: 1800 });
    } catch (error) {
      logger.warn(
        `Failed to cache department-system users data: ${error.message}`
      );
    }

    return users;
  } catch (error) {
    throw new AppError(
      `Error fetching users by department and system: ${error.message}`,
      error.statusCode || 400
    );
  }
};

const getAllUsersFromRawQuery = async () => {
  try {
    const data = await User.findAll();
    return data;
  } catch (error) {
    throw new AppError(
      `Error fetching all users: ${error.message}`,
      error.statusCode || 400
    );
  }
};

const getUserDataByID = async (userId) => {
  try {
    // Validate userId parameter
    if (!userId || (typeof userId !== "string" && typeof userId !== "number")) {
      throw new AppError("Valid User ID is required!", 400);
    }

    const cacheKey = buildSafeRedisKey("getUserDataByID", userId);
    const cachedData = await client.get(cacheKey);

    if (cachedData) {
      try {
        return safeJsonParse(cachedData, { maxLength: 10000 });
      } catch (error) {
        logger.warn(
          `Failed to parse cached user data safely: ${error.message}`
        );
        // Continue to fetch fresh data if cache is corrupted
      }
    }

    const userData = await user.findOne({
      where: {
        id: userId,
      },
      attributes: { exclude: ["password"] },
    });

    if (userData) {
      try {
        await client.set(cacheKey, safeJsonStringify(userData), { EX: 86400 }); // Cache for 1 day
      } catch (error) {
        logger.warn(`Failed to cache user data safely: ${error.message}`);
      }
    }

    return userData;
  } catch (error) {
    throw new AppError(
      `Error fetching user data: ${error.message}`,
      error.statusCode || 400
    );
  }
};

// Fetch multiple users by IDs
const getUsersDataByIDs = async (ids) => {
  try {
    // Accepts array of IDs (as strings or numbers)
    const users = await user.findAll({
      where: { id: ids },
      attributes: [
        "id",
        "name",
        "email",
        "mobile_no",
        "wfx_username",
        "is_active",
        "is_internal_user",
        "created_at",
        "updated_at",
      ],
    });
    return users;
  } catch (error) {
    throw new AppError(
      `Error fetching users by IDs: ${error.message}`,
      error.statusCode || 400
    );
  }
};

const getUserDataByEmail = async (userEmail) => {
  try {
    const userData = await user.findOne({
      where: {
        email: userEmail,
      },
      attributes: { exclude: ["password"] },
    });

    return userData;
  } catch (error) {
    throw new AppError(
      `Error fetching user data: ${error.message}`,
      error.statusCode || 400
    );
  }
};

const getUserDataByEmailLike = async (userEmail) => {
  try {
    if (!userEmail) {
      throw new AppError("Email pattern is required", 400);
    }

    if (userEmail.length >= 3) {
      const userData = await user.findAll({
        where: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("email")),
          Sequelize.Op.like,
          `%${userEmail.toLowerCase()}%`
        ),
        attributes: { exclude: ["password"] },
      });

      return userData;
    } else {
      return [];
    }
  } catch (error) {
    throw new AppError(
      `Error fetching user data: ${error.message}`,
      error.statusCode || 400
    );
  }
};

const getUsersFactoryByUserID = async (userId) => {
  try {
    const userData = await UserFactory.findAll({
      where: {
        user_id: userId,
      },
    });

    let returnData = userData.length > 0 ? userData[0].factory_id : 0;
    return returnData;
  } catch (error) {
    throw new AppError(
      `Error fetching user factory: ${error.message}`,
      error.statusCode || 400
    );
  }
};

const getCOEUsers = async () => {
  try {
    const roleIds = [1, 11, 12];

    // Use a single ORM query to get all COE users at once
    const users = await user.findAll({
      attributes: ["id", "name", "email"],
      include: [
        {
          model: UserRole,
          attributes: [],
          where: {
            role_id: {
              [Sequelize.Op.in]: roleIds,
            },
          },
          required: true,
        },
      ],
      raw: true,
    });

    return users;
  } catch (error) {
    throw new AppError(
      `Error fetching COE users: ${error.message}`,
      error.statusCode || 500
    );
  }
};

const getUsersBySystemAndRole = async (systemName, roleName) => {
  try {
    if (!systemName) {
      throw new AppError("System is required!", 400);
    }

    const system = await System.findAll({
      where: {
        name: systemName,
      },
    });

    const role = await Role.findAll({
      where: {
        description: roleName,
      },
    });

    const roleIds = role.map((item) => item.id);

    const users = await user.findAll({
      include: [
        {
          model: UserSystem,
          where: { system_id: system[0].id },
        },
        {
          model: UserRole,
          where: { role_id: { [Sequelize.Op.in]: roleIds } },
        },
        {
          model: UserDepartment,
          include: [
            {
              model: Department,
            },
          ],
        },
      ],
      where: {
        is_active: 1,
      },
      attributes: { exclude: ["password"] },
    });

    return users;
  } catch (error) {
    throw new AppError(
      `Error fetching users by system and role: ${error.message}`,
      error.statusCode || 500
    );
  }
};

const getAllUserDataByID = async (userId) => {
  try {
    if (!userId) {
      throw new AppError("User ID is required!", 400);
    }

    // Get basic user data first
    const userData = await user.findByPk(userId, {
      attributes: [
        "id",
        "name",
        "email",
        "mobile_no",
        "wfx_username",
        "is_active",
        "is_internal_user",
        "created_at",
        "updated_at",
      ],
    });

    if (!userData) {
      return null;
    }

    // Use ORM queries for better security
    const [
      userRoles,
      userSystems,
      userDepartments,
      userCustomers,
      userFactories,
      userFunctions,
    ] = await Promise.all([
      // Get user roles with system info using ORM
      UserRole.findAll({
        attributes: [],
        where: { user_id: userId },
        include: [
          {
            model: Role,
            attributes: ["id", "description"],
            where: { archived: 0 },
            include: [
              {
                model: System,
                attributes: [["name", "system_name"]],
              },
            ],
            required: true,
          },
        ],
        raw: true,
        nest: true,
      }).then((results) =>
        results.map((item) => ({
          id: item.Role.id,
          description: item.Role.description,
          system_name: item.Role.System.system_name,
        }))
      ),

      // Get user systems
      UserSystem.findAll({
        attributes: [],
        where: { user_id: userId },
        include: [
          {
            model: System,
            attributes: ["id", "name"],
            where: { archived: 0 },
            required: true,
          },
        ],
        raw: true,
        nest: true,
      }).then((results) =>
        results.map((item) => ({
          id: item.System.id,
          name: item.System.name,
        }))
      ),

      // Get user departments with system info
      UserDepartment.findAll({
        attributes: [],
        where: { user_id: userId },
        include: [
          {
            model: Department,
            attributes: ["id", "name"],
            where: { archived: 0 },
            include: [
              {
                model: System,
                attributes: [["name", "system_name"]],
              },
            ],
            required: true,
          },
        ],
        raw: true,
        nest: true,
      }).then((results) =>
        results.map((item) => ({
          id: item.Department.id,
          name: item.Department.name,
          system_name: item.Department.System.system_name,
        }))
      ),

      // Get user customers
      UserCustomer.findAll({
        attributes: [],
        where: { user_id: userId },
        include: [
          {
            model: Customer,
            attributes: ["id", "name"],
            where: { archived: 0 },
            required: true,
          },
        ],
        raw: true,
        nest: true,
      }).then((results) =>
        results.map((item) => ({
          id: item.Customer.id,
          name: item.Customer.name,
        }))
      ),

      // Get user factories
      UserFactory.findAll({
        attributes: [],
        where: { user_id: userId },
        include: [
          {
            model: Factory,
            attributes: ["id", "name"],
            where: { archived: 0 },
            required: true,
          },
        ],
        raw: true,
        nest: true,
      }).then((results) =>
        results.map((item) => ({
          id: item.Factory.id,
          name: item.Factory.name,
        }))
      ),

      // Get user special functions with system info
      UserFunction.findAll({
        attributes: [],
        where: { user_id: userId },
        include: [
          {
            model: SpecialFunction,
            attributes: ["id", "name"],
            where: { archived: 0 },
            include: [
              {
                model: System,
                attributes: [["name", "system_name"]],
              },
            ],
            required: true,
          },
        ],
        raw: true,
        nest: true,
      }).then((results) =>
        results.map((item) => ({
          id: item.SpecialFunction.id,
          name: item.SpecialFunction.name,
          system_name: item.SpecialFunction.System.system_name,
        }))
      ),
    ]);

    // Build the response object
    const result = {
      ...userData.toJSON(),
      UserRoles: userRoles.map((role) => ({
        Role: {
          id: role.id,
          description: role.description,
          System: { name: role.system_name },
        },
      })),
      UserSystems: userSystems.map((system) => ({
        System: {
          id: system.id,
          name: system.name,
        },
      })),
      UserDepartments: userDepartments.map((dept) => ({
        Department: {
          id: dept.id,
          name: dept.name,
          System: { name: dept.system_name },
        },
      })),
      UserCustomers: userCustomers.map((customer) => ({
        Customer: {
          id: customer.id,
          name: customer.name,
        },
      })),
      UserFactories: userFactories.map((factory) => ({
        Factory: {
          id: factory.id,
          name: factory.name,
        },
      })),
      UserFunctions: userFunctions.map((func) => ({
        SpecialFunction: {
          id: func.id,
          name: func.name,
          System: { name: func.system_name },
        },
      })),
    };

    return result;
  } catch (error) {
    throw new AppError(
      `Error fetching all user data: ${error.message}`,
      error.statusCode || 400
    );
  }
};

const getAllUserDataByEmail = async (email) => {
  try {
    if (!email) {
      throw new AppError("User Email is required!", 400);
    }

    // Get basic user data first
    let userData = null;

    userData = await user.findOne({
      where: Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("email")),
        Sequelize.fn("LOWER", email)
      ),
      attributes: [
        "id",
        "name",
        "email",
        "mobile_no",
        "wfx_username",
        "is_active",
        "is_internal_user",
        "created_at",
        "updated_at",
        "sso_login_enabled",
      ],
    });

    if (!userData && !email.includes("@")) {
      const newEmail = `${email.toLowerCase()}@inqube.com`;

      userData = await user.findOne({
        where: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("email")),
          Sequelize.fn("LOWER", newEmail)
        ),
        attributes: [
          "id",
          "name",
          "email",
          "mobile_no",
          "wfx_username",
          "is_active",
          "is_internal_user",
          "created_at",
          "updated_at",
          "sso_login_enabled",
        ],
      });

      if (!userData) {
        throw new Error(`No users find with email - ${email} (${newEmail})`);
      }
    }

    if (!userData) {
      throw new Error(`No users find with email - ${email}`);
    }

    let userId = userData.id;

    // Use ORM queries for better security
    const [
      userRoles,
      userSystems,
      userDepartments,
      userCustomers,
      userFactories,
      userFunctions,
      userCountry,
    ] = await Promise.all([
      // Get user roles with system info using ORM
      UserRole.findAll({
        attributes: [],
        where: { user_id: userId },
        include: [
          {
            model: Role,
            attributes: ["id", "description"],
            where: { archived: 0 },
            include: [
              {
                model: System,
                attributes: [["name", "system_name"]],
              },
            ],
            required: true,
          },
        ],
        raw: true,
        nest: true,
      }).then((results) =>
        results.map((item) => ({
          id: item.Role.id,
          description: item.Role.description,
          system_name: item.Role.System.system_name,
        }))
      ),

      // Get user systems
      UserSystem.findAll({
        attributes: [],
        where: { user_id: userId },
        include: [
          {
            model: System,
            attributes: ["id", "name"],
            where: { archived: 0 },
            required: true,
          },
        ],
        raw: true,
        nest: true,
      }).then((results) =>
        results.map((item) => ({
          id: item.System.id,
          name: item.System.name,
        }))
      ),

      // Get user departments with system info
      UserDepartment.findAll({
        attributes: [],
        where: { user_id: userId },
        include: [
          {
            model: Department,
            attributes: ["id", "name"],
            where: { archived: 0 },
            include: [
              {
                model: System,
                attributes: [["name", "system_name"]],
              },
            ],
            required: true,
          },
        ],
        raw: true,
        nest: true,
      }).then((results) =>
        results.map((item) => ({
          id: item.Department.id,
          name: item.Department.name,
          system_name: item.Department.System.system_name,
        }))
      ),

      // Get user customers
      UserCustomer.findAll({
        attributes: [],
        where: { user_id: userId },
        include: [
          {
            model: Customer,
            attributes: ["id", "name"],
            where: { archived: 0 },
            required: true,
          },
        ],
        raw: true,
        nest: true,
      }).then((results) =>
        results.map((item) => ({
          id: item.Customer.id,
          name: item.Customer.name,
        }))
      ),

      // Get user factories
      UserFactory.findAll({
        attributes: [],
        where: { user_id: userId },
        include: [
          {
            model: Factory,
            attributes: ["id", "name"],
            where: { archived: 0 },
            required: true,
          },
        ],
        raw: true,
        nest: true,
      }).then((results) =>
        results.map((item) => ({
          id: item.Factory.id,
          name: item.Factory.name,
        }))
      ),

      // Get user special functions with system info
      UserFunction.findAll({
        attributes: [],
        where: { user_id: userId },
        include: [
          {
            model: SpecialFunction,
            attributes: ["id", "name"],
            where: { archived: 0 },
            include: [
              {
                model: System,
                attributes: [["name", "system_name"]],
              },
            ],
            required: true,
          },
        ],
        raw: true,
        nest: true,
      }).then((results) =>
        results.map((item) => ({
          id: item.SpecialFunction.id,
          name: item.SpecialFunction.name,
          system_name: item.SpecialFunction.System.system_name,
        }))
      ),

      // Get user country
      UserCountry.findAll({
        attributes: [],
        where: { user_id: userId },
        include: [
          {
            model: Country,
            attributes: ["id", "name"],
            where: { archived: 0 },
            required: true,
          },
        ],
        raw: true,
        nest: true,
      }).then((results) =>
        results.map((item) => ({
          id: item.Country.id,
          name: item.Country.name,
        }))
      ),
    ]);

    // Build the response object
    const result = {
      ...userData.toJSON(),
      UserRoles: userRoles.map((role) => ({
        Role: {
          id: role.id,
          description: role.description,
          System: { name: role.system_name },
        },
      })),
      UserSystems: userSystems.map((system) => ({
        System: {
          id: system.id,
          name: system.name,
        },
      })),
      UserDepartments: userDepartments.map((dept) => ({
        Department: {
          id: dept.id,
          name: dept.name,
          System: { name: dept.system_name },
        },
      })),
      UserCustomers: userCustomers.map((customer) => ({
        Customer: {
          id: customer.id,
          name: customer.name,
        },
      })),
      UserFactories: userFactories.map((factory) => ({
        Factory: {
          id: factory.id,
          name: factory.name,
        },
      })),
      UserFunctions: userFunctions.map((func) => ({
        SpecialFunction: {
          id: func.id,
          name: func.name,
          System: { name: func.system_name },
        },
      })),
      UserCountries: userCountry.map((country) => ({
        Country: {
          id: country.id,
          name: country.name,
        },
      })),
    };

    return result;
  } catch (error) {
    throw new AppError(`Error : ${error.message}`, error.statusCode || 400);
  }
};

const getUsersByCustomer = async (customerName) => {
  try {
    if (!customerName || typeof customerName !== "string") {
      throw new AppError("Valid customer name is required!", 400);
    }

    // Sanitize customer name input
    const safeCustomerName = customerName.trim();
    if (safeCustomerName.length === 0) {
      throw new AppError("Customer name cannot be empty!", 400);
    }

    const cacheKey = buildSafeRedisKey("getUsersByCustomer", safeCustomerName);

    // Check if data is cached
    const cachedData = await client.get(cacheKey);
    if (cachedData) {
      try {
        return safeJsonParse(cachedData, { maxLength: 200000 });
      } catch (error) {
        logger.warn(
          `Failed to parse cached customer users data safely: ${error.message}`
        );
        // Continue to fetch fresh data if cache is corrupted
      }
    }

    const results = await Customer.findAll({
      attributes: [
        ["id", "customer_id"],
        ["name", "customer_name"],
      ],
      where: { name: safeCustomerName },
      include: [
        {
          model: UserCustomer,
          attributes: [],
          include: [
            {
              model: user,
              attributes: [
                ["id", "user_id"],
                ["name", "user_name"],
                ["email", "user_email"],
              ],
              where: { is_active: 1 },
              include: [
                {
                  model: UserRole,
                  attributes: [],
                  include: [
                    {
                      model: Role,
                      attributes: [
                        ["id", "role_id"],
                        ["description", "role_description"],
                      ],
                      where: { archived: 0 },
                      required: false,
                    },
                  ],
                  required: false,
                },
              ],
              required: true,
            },
          ],
          required: true,
        },
      ],
      raw: true,
      nest: true,
    });

    // return results

    // With raw: true and nest: true, the results are already flattened
    // Each row represents one user-role combination
    const flatResults = results.map((row) => ({
      user_id: row.UserCustomers.User.user_id,
      user_name: row.UserCustomers.User.user_name,
      user_email: row.UserCustomers.User.user_email,
      role_id: row.UserCustomers.User.UserRoles?.Role?.role_id || null,
      role_description:
        row.UserCustomers.User.UserRoles?.Role?.role_description || null,
    }));

    // Transform the flat results into the expected structure
    const roleMap = new Map();

    flatResults.forEach((row) => {
      const { user_id, user_name, user_email, role_id, role_description } = row;

      // Skip rows without role (users with no roles)
      if (!role_id) return;

      let roleEntry = roleMap.get(role_id);
      if (!roleEntry) {
        roleEntry = {
          role_id: role_id,
          description: role_description,
          users: [],
        };
        roleMap.set(role_id, roleEntry);
      }

      // Check if user already exists in this role to avoid duplicates
      const userExists = roleEntry.users.some((user) => user.id === user_id);
      if (!userExists) {
        roleEntry.users.push({
          id: user_id,
          name: user_name,
          email: user_email,
        });
      }
    });

    const transformedUsers = Array.from(roleMap.values());

    // Cache the result for 1 hour
    try {
      await client.set(cacheKey, safeJsonStringify(transformedUsers), {
        EX: 3600,
      });
    } catch (error) {
      logger.warn(`Failed to cache transformed users safely: ${error.message}`);
    }

    return transformedUsers;
  } catch (error) {
    throw new AppError(
      `Error fetching users by customer: ${error.message}`,
      error.statusCode || 500
    );
  }
};

function generateValidPassword(length = 10) {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const specials = "!@#$%^&*";

  // Ensure at least one of each required character type
  let password = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
    specials[Math.floor(Math.random() * specials.length)],
  ];

  // Fill the rest with random characters from all sets
  const allChars = uppercase + lowercase + digits + specials;
  for (let i = password.length; i < length; i++) {
    password.push(allChars[Math.floor(Math.random() * allChars.length)]);
  }

  // Shuffle the password array
  password = password.sort(() => Math.random() - 0.5);

  return password.join("");
}

const resetUserPassword = async (email, newPasswordR, resetBy, userEmail) => {
  const t = await sequelize.transaction();
  try {
    if (!email) {
      throw new AppError("Email is required!", 400);
    }

    let newPassword = generateValidPassword(8) || newPasswordR;

    if (!newPassword) {
      throw new AppError("New Password is required!", 400);
    }

    const User = await util.isUserAvailable(email);

    if (User.sso_login_enabled == 1) {
      throw new AppError(
        "Reset password is not available for SSO login enabled users.",
        400
      );
    }

    if (!User || User == "None") {
      throw new AppError("User not found!", 400);
    }

    const passwordMatch = await bcrypt.compare(newPassword, User?.password);

    if (passwordMatch) {
      throw new AppError("New password cannot be the existing password!", 400);
    }

    if (newPassword.length < 8) {
      throw new AppError("Password must contain at least 8 letters", 400);
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.*\d).+$/;

    if (!passwordRegex.test(newPassword)) {
      throw new AppError(
        "Password must contain at least one uppercase letter, one special character, and one number.",
        400
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedData = {
      password: hashedPassword,
      has_password_changed: 0,
    };

    const updateConditions = {
      email: email,
    };

    await User.update(updatedData, {
      where: updateConditions,
      transaction: t,
    });

    const userModule = await System.findAll({
      where: {
        name: "User Module",
      },
    });

    // Generate JWT token for password reset link (expires in 15 mins)
    const token = jwt.sign({ email: User.get("email") }, JWT_SECRET, {
      expiresIn: "15m",
    });

    // Assume systems is available, fallback to empty string if not
    let resetUrl = "";
    if (
      Array.isArray(userModule) &&
      userModule.length > 0 &&
      userModule[0].url
    ) {
      resetUrl = `${userModule[0].url}/changePassword?token=${token}`;
    }

    const emailObjTemp = {
      from: "noreply@inqube.com",
      to: [User.get("email")],
      cc: [],
      bcc: [],
      subject: "InqCloud - Password Reset",
      text: "Dear User,\n\n",
      html: ` <html>
            <body style="font-family: Arial, sans-serif; color: #222; line-height: 1.6;">
              <p>Dear User,</p>

              <p>
                Your password for <strong>InqCloud Applications</strong> has been reset by
                <strong>${resetBy}</strong>.
              </p>

              <p>
                <strong>Your one-time temporary password:</strong><br>
                <span style="font-size: 1.2em; color: #007bff;">
                  ${newPassword}
                </span>
              </p>

              <p>
                For security reasons, you are required to change this temporary password before accessing InqCloud applications.
              </p>

              <p>
                Please click the link below to set a new password:
              </p>

              <p>
                <a href="${resetUrl}" style="color: #007bff; text-decoration: underline;">
                  Set a new password (link valid for 15 minutes)
                </a>
              </p>

              <p>
                If you did not request this password reset, please contact your system administrator immediately.
              </p>

              <br>

              <p>
                Best regards,<br>
                <strong>InqApps Team</strong>
              </p>
            </body>
          </html>
          `,
    };

    await sendMessageToKafkForEmail(emailObjTemp);

    const superUsers = await getSuperUsers();
    const superUserEmails = superUsers
      .map((uc) => uc.get({ plain: true }))
      .map((item) => item.email);

    //Send notification
    const notificationObjTemp = {
      emails: [...superUserEmails, userEmail] || [],
      title: `Password Reset`,
      body: `${userEmail} have reset the password of ${User.get("email")}`,
      data: {
        type: "info",
        system: "User Module",
      },
    };

    sendMessageToKafkaForNotification(notificationObjTemp).catch((error) => {
      logger.error("Notification sending failed:", error);
    });

    // Log creation event
    try {
        const worker = new Worker(
            path.join(__dirname, '../workers/LogsCreateWorker.js'),
            {
                workerData: {
                    action_taken: `RESET by ${resetBy} of ${userEmail}`,
                    table_name: 'tbl_users',
                    column_name: 'password',
                    from_value: JSON.stringify({ name: "Hidden for better security" }),
                    to_value: JSON.stringify({ name: "Hidden for better security" })
                }
            }
        );
        worker.on('error', (logErr) => {
            logger.error('User creation log worker error:', logErr);
        });
        
    } catch (logErr) {
        logger.error('User creation log worker failed:', logErr);
    }

    // Invalidate all paginated cache entries
    await deletePaginatedCache("getAllUsers:page:*:pageSize:*");

    await t.commit();
    return { message: "Password Reset Successfully!" };
  } catch (error) {
    await t.rollback();
    throw new AppError(
      `Error resetting password: ${error.message}`,
      error.statusCode || 400
    );
  }
};

// Fetch multiple users by emails
const getUsersDataByEmails = async (emails) => {
  try {
    // Accepts array of emails (as strings)
    const users = await user.findAll({
      where: { email: emails },
      attributes: [
        "id",
        "name",
        "email",
        "mobile_no",
        "wfx_username",
        "is_active",
        "is_internal_user",
        "created_at",
        "updated_at",
      ],
    });
    return users;
  } catch (error) {
    throw new AppError(
      `Error fetching users by emails: ${error.message}`,
      error.statusCode || 400
    );
  }
};

const getSuperUsers = async () => {
  try {
    const superAdminUsers = await user.findAll({
      attributes: ["id", "name", "email", "is_active"],
      where: {
        is_active: 1,
      },
      include: [
        {
          model: UserRole,
          attributes: ["id", "role_id", "user_id"],
          where: {
            role_id: 79,
          },
          include: [
            {
              model: Role,
              attributes: ["id", "description"],
              where: {
                id: 79,
                archived: 0,
              },
            },
          ],
        },
      ],
      order: [["name", "ASC"]],
    });

    return superAdminUsers;
  } catch (error) {
    throw new AppError(
      `Error fetching super admin users: ${error.message}`,
      error.statusCode || 500
    );
  }
};

// Send email and app notification to super admins
const askFromSuperAdmin = async (superAdmins, fileds, message, userEmail) => {
  try {
    const users = await user.findAll({
      where: { id: superAdmins },
      attributes: ["id", "email"],
    });

    const requestedUser = await user.findAll({
      where: { email: userEmail },
      attributes: ["id", "name"],
    });

    const emailObjTemp = {
      from: "noreply@inqube.com",
      to: users.map((item) => item.email),
      cc: [userEmail],
      bcc: [],
      subject: "InqCloud - Ask From Super Admin",
      text: "Dear Super Admin,\n\n",
      html: ` <html>
          <body style="font-family: Arial, sans-serif; color: #222;">
            <p>Dear Super Admin,</p>
            <p>
              You have a request to create/grant permission for <strong>${fileds[0]}</strong> in <strong>InqCloud Applications</strong>.
            </p>
            <p>
              Requested by -  <strong>${requestedUser[0].name}</strong>.
            </p>
            <p>
              Message - ${message}
            </p>
            <br>
            <p>Best Regards,<br>InqApps</p>
          </body>
        </html>`,
    };

    await sendMessageToKafkForEmail(emailObjTemp);

    // Send app notification
    const notificationObjTemp = {
      emails: users.map((item) => item.email) || [],
      title: `Master Data / Permission`,
      body: `${requestedUser[0].name} has requested you to create/grant permission for ${fileds[0]} with the following message: ${message}`,
      data: {
        type: "info",
        system: "User Module",
      },
    };

    sendMessageToKafkaForNotification(notificationObjTemp).catch((error) => {
      logger.error("Notification sending failed:", error);
    });

    return "success";
  } catch (error) {
    throw new AppError(
      `Error ask from super admin: ${error.message}`,
      error.statusCode || 400
    );
  }
};

module.exports = {
  getAllUsers,
  getAllUsersBackoffice,
  createUser,
  resetPasswordByUser,
  updateUser,
  changePassword,
  getUsersByDepartmentAndSystem,
  getAllUsersFromRawQuery,
  getUserDataByID,
  getUsersDataByIDs,
  getUserDataByEmail,
  getUsersFactoryByUserID,
  getCOEUsers,
  getUsersBySystemAndRole,
  getAllUserDataByID,
  getUsersByCustomer,
  resetUserPassword,
  getUsersDataByEmails,
  getUserDataByEmailLike,
  getAllUserDataByEmail,
  getScheduledEmailsStatus,
  askFromSuperAdmin,
  getSuperUsers,
};
