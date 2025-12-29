const User = require("../models/user");
const UserSystem = require("../models/userSystem");
const UserRole = require("../models/userRole");
const UserDepartment = require("../models/userDepartments");
const Role = require("../models/role");
const Department = require("../models/department");
const System = require("../models/system");

const sequelize = require("../database/index.js");
const { getSuperUsers } = require('../repositories/user.repository.js')
const {
  sendMessageToKafkForEmail,
  sendDowntimeSSEAlert,
  sendMessageToKafkaForNotification
} = require("../kafka/controller.js");
// const sseManager = require("../utils/sseManager");
const logger = require("../utils/logger");
const DowntimeLogs = require("../models/downtimeLogs.js");
const { getCurrentDateForDB } = require("../utils/dateUtils.js");
const { finished } = require("nodemailer/lib/xoauth2/index.js");
const { getAllUserDataByEmail } = require("../repositories/user.repository");

const getUsersBySystemRoleDepartment = async (req, res, next) => {
  try {
    const { systemId, roleId, departmentId } = req.body;

    if (!systemId) {
      return res
        .status(400)
        .json({ success: false, message: "systemId is required" });
    }

    // Build include array dynamically
    const include = [
      {
        model: UserSystem,
        where: { system_id: systemId },
        required: true,
      },
    ];

    if (roleId) {
      include.push({
        model: UserRole,
        where: { role_id: roleId },
        required: true,
        include: [{ model: Role, attributes: ["description", "id"] }],
      });
    } else {
      include.push({
        model: UserRole,
        required: false,
        include: [{ model: Role, attributes: ["description", "id"] }],
      });
    }

    if (departmentId) {
      include.push({
        model: UserDepartment,
        where: { department_id: departmentId },
        required: true,
        include: [{ model: Department, attributes: ["name", "id"] }],
      });
    } else {
      include.push({
        model: UserDepartment,
        required: false,
        include: [{ model: Department, attributes: ["name", "id"] }],
      });
    }

    const users = await User.findAll({
      include,
      where: { is_active: 1 },
    });

    res.status(200).json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const sendEmails = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { subject, message, emails, fromTime, toTime, system, userName } =
      req.body;

    const isHtml = /<\/?[a-z][\s\S]*>/i.test(message);

    const emailObjTemp = {
      from: "noreply@inqube.com",
      to: emails,
      cc: [],
      bcc: [],
      subject: subject,
      text: isHtml ? "a" : message,
      html: isHtml ? message : undefined,
    };

    if (
      subject.includes("Downtime") &&
      system &&
      fromTime &&
      toTime &&
      userName
    ) {
      if (system.value) {
        const userData = await getAllUserDataByEmail(userName);

        const systemHave = userData.UserSystems.find(
          (item) => item.System.id == system.value
        );

        const isSuperAdmin = userData.UserRoles.find(
          (item) => item.Role.description == "BackofficeSuperAdmin"
        );

        if (!isSuperAdmin && !systemHave) {
          throw new Error(
            "Sorry! You do not have premissions to create downtimes for selected system."
          );
        }
      }

      const superUsers = await getSuperUsers();
      const superUserEmails = superUsers
        .map((uc) => uc.get({ plain: true }))
        .map((item) => item.email);

      // Send app notification
      const notificationObjTempAdmin = {
        emails:
          [...superUserEmails, userName] || [],
        title: `Downtime Alert`,
        body: `${
          userName || "Anonymous"
        } has scheduled a downtime in ${system.label} from ${fromTime} to ${toTime}`,
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

      await DowntimeLogs.create(
        {
          system_id: system.value,
          from_time: fromTime,
          to_time: toTime,
          reason: "",
          finished: 0,
          created_at: getCurrentDateForDB(),
          created_by: userName,
          updated_at: getCurrentDateForDB(),
          updated_by: userName,
        },
        { transaction: t }
      );
    }

    await sendMessageToKafkForEmail(emailObjTemp);

    const downtimeAlertObj = {
      system: system.label,
      fromTime,
      toTime,
      noOfEmails: emails.length,
      subject,
    };

    await sendDowntimeSSEAlert(downtimeAlertObj);

    await t.commit();
    res.status(200).json({ success: true, data: emails });
  } catch (err) {
    await t.rollback();
    logger.error(`Error sending email: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getUsersBySystemRoleDepartment,
  sendEmails,
};
