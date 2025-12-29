const repo = require("../repositories/userHierarchy.repository");
const { formatSuccessResponse, formatErrorResponse } = require("../utils/formatting/dateFormatter");

/**
 * Get all user hierarchies
 */
const getAllHierarchies = async (req, res, next) => {
  try {
    const result = await repo.getAllHierarchies();
    res.status(200).json(formatSuccessResponse(result, "Hierarchies retrieved successfully", result.length));
  } catch (e) {
    res.status(e.statusCode || 400).json(formatErrorResponse(e.message));
  }
};

/**
 * Get all reportees (subordinates) by reporter_id
 * Reporter = Manager/Supervisor
 * Returns employees who report to this manager in DESCENDING order
 */
const getReporteesByReporterId = async (req, res, next) => {
  try {
    const { reporterId } = req.params;
    
    if (!reporterId) {
      return res.status(400).json(formatErrorResponse("Reporter ID is required"));
    }

    const result = await repo.getReporteesByReporterId(reporterId);
    res.status(200).json(formatSuccessResponse(result, "Reportees retrieved successfully", result.length));
  } catch (e) {
    res.status(e.statusCode || 400).json(formatErrorResponse(e.message));
  }
};

/**
 * Get all reporters (supervisors) by reportee_id
 * Reportee = Employee
 * Returns managers/supervisors this employee reports to in ASCENDING order
 */
const getReportersByReporteeId = async (req, res, next) => {
  try {
    const { reporteeId } = req.params;
    
    if (!reporteeId) {
      return res.status(400).json(formatErrorResponse("Reportee ID is required"));
    }

    const result = await repo.getReportersByReporteeId(reporteeId);
    res.status(200).json(formatSuccessResponse(result, "Reporters retrieved successfully", result.length));
  } catch (e) {
    res.status(e.statusCode || 400).json(formatErrorResponse(e.message));
  }
};

/**
 * Create a new user hierarchy relationship
 */
const createHierarchy = async (req, res, next) => {
  try {
    const result = await repo.createHierarchy(req.body);
    res.status(201).json(formatSuccessResponse(result, "Hierarchy created successfully"));
  } catch (e) {
    res.status(e.statusCode || 400).json(formatErrorResponse(e.message));
  }
};

/**
 * Update hierarchy status (activate/deactivate)
 */
const updateHierarchyStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { active_status, updated_by } = req.body;

    if (!active_status || !updated_by) {
      return res.status(400).json(formatErrorResponse("Active status and Updated By are required"));
    }

    const result = await repo.updateHierarchyStatus(id, active_status, updated_by);
    res.status(200).json(formatSuccessResponse(result, "Hierarchy status updated successfully"));
  } catch (e) {
    res.status(e.statusCode || 400).json(formatErrorResponse(e.message));
  }
};

/**
 * Delete (deactivate) user hierarchy
 */
const deleteHierarchy = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { updated_by } = req.body;

    if (!updated_by) {
      return res.status(400).json(formatErrorResponse("Updated By is required"));
    }

    const result = await repo.deleteHierarchy(id, updated_by);
    res.status(200).json(formatSuccessResponse(result, "Hierarchy deleted successfully"));
  } catch (e) {
    res.status(e.statusCode || 400).json(formatErrorResponse(e.message));
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
