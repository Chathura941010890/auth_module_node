const { Sequelize, Op } = require("sequelize");
const UserHierarchy = require("../models/userHierarchy");
const User = require("../models/user");
const AppError = require("../utils/appError");
const { buildSafeRedisKey } = require('../utils/redisSecurityUtils');
const { safeJsonParse, safeJsonStringify } = require('../utils/jsonSecurityUtils');
const { client } = require('../database/redisClient.js');
const logger = require('../utils/logger');

/**
 * Get all user hierarchies with user details
 */
const getAllHierarchies = async () => {
  try {
    // Build cache key
    // const cacheKey = buildSafeRedisKey('getAllHierarchies');
    
    // // Check cache first
    // const cachedData = await client.get(cacheKey);
    // if (cachedData) {
    //   try {
    //     return safeJsonParse(cachedData, { maxLength: 100000 });
    //   } catch (error) {
    //     logger.warn(`Failed to parse cached hierarchies data: ${error.message}`);
    //   }
    // }

    const hierarchies = await UserHierarchy.findAll({
      where: { active_status: '1' },
      include: [
        {
          model: User,
          as: 'reporter',
          attributes: ['id', 'name', 'email', 'is_active']
        },
        {
          model: User,
          as: 'reportee',
          attributes: ['id', 'name', 'email', 'is_active']
        }
      ],
      order: [['id', 'ASC']]
    });

    // Cache the results for 30 minutes
    // try {
    //   await client.set(cacheKey, safeJsonStringify(hierarchies), { EX: 1800 });
    // } catch (error) {
    //   logger.warn(`Failed to cache hierarchies data: ${error.message}`);
    // }

    return hierarchies;
  } catch (error) {
    throw new AppError(`Error fetching all hierarchies: ${error.message}`, 400);
  }
};

/**
 * Recursive helper to fetch reportees hierarchy (downward chain)
 */
const fetchReporteesRecursive = async (reporteeId) => {
  const reportee = await User.findByPk(reporteeId, {
    attributes: ['id', 'name', 'email', 'is_active']
  });

  if (!reportee) {
    return null;
  }

  // Get direct reportees of this user
  const hierarchies = await UserHierarchy.findAll({
    where: {
      reporter_id: reporteeId,
      active_status: '1'
    },
    order: [['id', 'ASC']]
  });

  // Recursively fetch reportees for each reportee
  const reportees = [];
  for (const hierarchy of hierarchies) {
    const nestedReportee = await fetchReporteesRecursive(hierarchy.reportee_id);
    if (nestedReportee) {
      reportees.push(nestedReportee);
    }
  }

  return {
    ...reportee.toJSON(),
    reportees: reportees.length > 0 ? reportees : undefined
  };
};

/**
 * Get all reportees (subordinates) by reporter_id with full hierarchy chain
 * Reporter = Manager/Supervisor
 * Reportees = Employees who report to this manager (and their reportees recursively)
 * Returns nested structure in ascending order: reporter with reportees, each reportee with their reportees, etc.
 */
const getReporteesByReporterId = async (reporterId) => {
  try {
    if (!reporterId) {
      throw new AppError("Reporter ID is required", 400);
    }

    // Build cache key
    // const cacheKey = buildSafeRedisKey('getReporteesByReporterId', reporterId);
    
    // // Check cache first
    // const cachedData = await client.get(cacheKey);
    // if (cachedData) {
    //   try {
    //     return safeJsonParse(cachedData, { maxLength: 100000 });
    //   } catch (error) {
    //     logger.warn(`Failed to parse cached reportees data: ${error.message}`);
    //   }
    // }

    // Get reporter details
    const reporter = await User.findByPk(reporterId, {
      attributes: ['id', 'name', 'email', 'is_active']
    });

    if (!reporter) {
      throw new AppError("Reporter user not found", 404);
    }

    // Get all direct reportees for this reporter
    const hierarchies = await UserHierarchy.findAll({
      where: {
        reporter_id: reporterId,
        active_status: '1'
      },
      order: [['id', 'ASC']]
    });

    // Recursively build reportees hierarchy
    const reportees = [];
    for (const hierarchy of hierarchies) {
      const nestedReportee = await fetchReporteesRecursive(hierarchy.reportee_id);
      if (nestedReportee) {
        reportees.push(nestedReportee);
      }
    }

    // Build nested response
    const response = {
      ...reporter.toJSON(),
      reportees: reportees.length > 0 ? reportees : []
    };

    // Cache the results for 30 minutes
    // try {
    //   await client.set(cacheKey, safeJsonStringify(response), { EX: 1800 });
    // } catch (error) {
    //   logger.warn(`Failed to cache reportees data: ${error.message}`);
    // }

    return response;
  } catch (error) {
    throw new AppError(`Error fetching reportees: ${error.message}`, 400);
  }
};

/**
 * Recursive helper to fetch reporters hierarchy (upward chain)
 */
const fetchReportersRecursive = async (reporterId) => {
  const reporter = await User.findByPk(reporterId, {
    attributes: ['id', 'name', 'email', 'is_active']
  });

  if (!reporter) {
    return null;
  }

  // Get direct reporters of this user (people this user reports to)
  const hierarchies = await UserHierarchy.findAll({
    where: {
      reportee_id: reporterId,
      active_status: '1'
    },
    order: [['id', 'DESC']]
  });

  // Recursively fetch reporters for each reporter
  const reporters = [];
  for (const hierarchy of hierarchies) {
    const nestedReporter = await fetchReportersRecursive(hierarchy.reporter_id);
    if (nestedReporter) {
      reporters.push(nestedReporter);
    }
  }

  return {
    ...reporter.toJSON(),
    reporters: reporters.length > 0 ? reporters : undefined
  };
};

/**
 * Get all reporters (supervisors) by reportee_id with full hierarchy chain
 * Reportee = Employee
 * Reporters = Managers/Supervisors this employee reports to (and their reporters recursively)
 * Returns nested structure in descending order: reportee with reporters, each reporter with their reporters, etc.
 */
const getReportersByReporteeId = async (reporteeId) => {
  try {
    if (!reporteeId) {
      throw new AppError("Reportee ID is required", 400);
    }

    // Build cache key
    // const cacheKey = buildSafeRedisKey('getReportersByReporteeId', reporteeId);
    
    // // Check cache first
    // const cachedData = await client.get(cacheKey);
    // if (cachedData) {
    //   try {
    //     return safeJsonParse(cachedData, { maxLength: 100000 });
    //   } catch (error) {
    //     logger.warn(`Failed to parse cached reporters data: ${error.message}`);
    //   }
    // }

    // Get reportee details
    const reportee = await User.findByPk(reporteeId, {
      attributes: ['id', 'name', 'email', 'is_active']
    });

    if (!reportee) {
      throw new AppError("Reportee user not found", 404);
    }

    // Get all direct reporters for this reportee
    const hierarchies = await UserHierarchy.findAll({
      where: {
        reportee_id: reporteeId,
        active_status: '1'
      },
      order: [['id', 'DESC']]
    });

    // Recursively build reporters hierarchy
    const reporters = [];
    for (const hierarchy of hierarchies) {
      const nestedReporter = await fetchReportersRecursive(hierarchy.reporter_id);
      if (nestedReporter) {
        reporters.push(nestedReporter);
      }
    }

    // Build nested response
    const response = {
      ...reportee.toJSON(),
      reporters: reporters.length > 0 ? reporters : []
    };

    // Cache the results for 30 minutes
    // try {
    //   await client.set(cacheKey, safeJsonStringify(response), { EX: 1800 });
    // } catch (error) {
    //   logger.warn(`Failed to cache reporters data: ${error.message}`);
    // }

    return response;
  } catch (error) {
    throw new AppError(`Error fetching reporters: ${error.message}`, 400);
  }
};

/**
 * Create a new user hierarchy relationship
 */
const createHierarchy = async (data) => {
  try {
    const { reporter_id, reportee_id, created_by } = data;

    if (!reporter_id || !reportee_id || !created_by) {
      throw new AppError("Reporter ID, Reportee ID, and Created By are required", 400);
    }

    // Check if relationship already exists
    const existingHierarchy = await UserHierarchy.findOne({
      where: {
        reporter_id,
        reportee_id
      }
    });

    if (existingHierarchy) {
      throw new AppError("Hierarchy relationship already exists", 400);
    }

    // Verify both users exist
    const reporter = await User.findByPk(reporter_id);
    const reportee = await User.findByPk(reportee_id);

    if (!reporter) {
      throw new AppError("Reporter user not found", 404);
    }

    if (!reportee) {
      throw new AppError("Reportee user not found", 404);
    }

    const now = new Date();
    const hierarchy = await UserHierarchy.create({
      reporter_id,
      reportee_id,
      active_status: '1',
      created_by,
      created_at: now,
      updated_by: created_by,
      updated_at: now
    });

    // Clear related caches
    await clearHierarchyCaches(reporter_id, reportee_id);

    return hierarchy;
  } catch (error) {
    throw new AppError(`Error creating hierarchy: ${error.message}`, 400);
  }
};

/**
 * Update user hierarchy status
 */
const updateHierarchyStatus = async (id, active_status, updated_by) => {
  try {
    if (!id || !updated_by) {
      throw new AppError("Hierarchy ID and Updated By are required", 400);
    }

    if (!['0', '1'].includes(active_status)) {
      throw new AppError("Active status must be '0' or '1'", 400);
    }

    const hierarchy = await UserHierarchy.findByPk(id);

    if (!hierarchy) {
      throw new AppError("Hierarchy not found", 404);
    }

    hierarchy.active_status = active_status;
    hierarchy.updated_by = updated_by;
    hierarchy.updated_at = new Date();

    await hierarchy.save();

    // Clear related caches
    await clearHierarchyCaches(hierarchy.reporter_id, hierarchy.reportee_id);

    return hierarchy;
  } catch (error) {
    throw new AppError(`Error updating hierarchy: ${error.message}`, 400);
  }
};

/**
 * Delete (deactivate) user hierarchy
 */
const deleteHierarchy = async (id, updated_by) => {
  try {
    if (!id || !updated_by) {
      throw new AppError("Hierarchy ID and Updated By are required", 400);
    }

    const hierarchy = await UserHierarchy.findByPk(id);

    if (!hierarchy) {
      throw new AppError("Hierarchy not found", 404);
    }

    hierarchy.active_status = '0';
    hierarchy.updated_by = updated_by;
    hierarchy.updated_at = new Date();

    await hierarchy.save();

    // Clear related caches
    await clearHierarchyCaches(hierarchy.reporter_id, hierarchy.reportee_id);

    return { message: "Hierarchy deactivated successfully" };
  } catch (error) {
    throw new AppError(`Error deleting hierarchy: ${error.message}`, 400);
  }
};

/**
 * Clear hierarchy-related caches
 */
const clearHierarchyCaches = async (reporterId, reporteeId) => {
  try {
    const keysToDelete = [
      buildSafeRedisKey('getAllHierarchies'),
      buildSafeRedisKey('getReporteesByReporterId', reporterId),
      buildSafeRedisKey('getReportersByReporteeId', reporteeId)
    ];

    await Promise.all(keysToDelete.map(key => client.del(key)));
  } catch (error) {
    logger.warn(`Failed to clear hierarchy caches: ${error.message}`);
  }
};

module.exports = {
  getAllHierarchies,
  getReporteesByReporterId,
  getReportersByReporteeId,
  createHierarchy,
  updateHierarchyStatus,
  deleteHierarchy
};
