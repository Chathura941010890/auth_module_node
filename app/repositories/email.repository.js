const User = require("../models/user");
const UserSystem = require("../models/userSystem");
const UserRole = require("../models/userRole");
const UserDepartment = require("../models/userDepartments");
const Role = require("../models/role");
const Department = require("../models/department");
const System = require("../models/system");

const AppError = require('../utils/appError');
const { sendMessageToKafkForEmail } = require("../kafka/controller.js");

/**
 * Get users by system, role, and department
 */
const getUsersBySystemRoleDepartment = async (systemId, roleId, departmentId) => {
  try {
    if (!systemId) {
      throw new AppError("systemId is required", 400);
    }

    let whereClause = {
      is_active: 1,
    };

    let includeClause = [
      {
        model: UserSystem,
        where: { system_id: systemId },
        include: [
          {
            model: System,
            attributes: ["name"],
          },
        ],
      },
    ];

    if (roleId) {
      includeClause.push({
        model: UserRole,
        where: { role_id: roleId },
        include: [
          {
            model: Role,
            attributes: ["description"],
          },
        ],
      });
    }

    if (departmentId) {
      includeClause.push({
        model: UserDepartment,
        where: { department_id: departmentId },
        include: [
          {
            model: Department,
            attributes: ["name"],
          },
        ],
      });
    }

    const users = await User.findAll({
      where: whereClause,
      include: includeClause,
      attributes: ["id", "name", "email"],
    });

    return users;
  } catch (error) {
    throw new AppError(`Error fetching users: ${error.message}`, error.statusCode || 400);
  }
};

/**
 * Send email to users
 */
const sendEmailToUsers = async (emailData) => {
  try {
    const { to, cc = [], bcc = [], subject, text = '', html = '' } = emailData;

    if (!to || !Array.isArray(to) || to.length === 0) {
      throw new AppError("Recipients (to) are required and must be a non-empty array", 400);
    }

    if (!subject) {
      throw new AppError("Email subject is required", 400);
    }

    if (!text && !html) {
      throw new AppError("Email content (text or html) is required", 400);
    }

    const emailObjTemp = {
      from: "noreply@inqube.com",
      to,
      cc,
      bcc,
      subject,
      text,
      html
    };

    await sendMessageToKafkForEmail(emailObjTemp);
    return { message: "Email sent successfully" };
  } catch (error) {
    throw new AppError(`Error sending email: ${error.message}`, error.statusCode || 400);
  }
};

module.exports = {
  getUsersBySystemRoleDepartment,
  sendEmailToUsers
};
