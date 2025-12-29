const permissionRepo = require('../repositories/permissions.repository')

const getAllPermissions = async (req, res, next) => {
    try {
        const permission = await permissionRepo.getAllPermissions();
        res.status(200).json(permission);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const permissionsByRoleDept = async (req, res, next) => {
    try {
        const { system_id, role_id, dept_id } = req.params;
        const permission = await permissionRepo.permissionsByRoleDept(system_id, role_id, dept_id);
        res.status(200).json(permission);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const savePermissions = async (req, res, next) => {
    try {
        const permission = await permissionRepo.savePermissions(req);
        res.status(200).json(permission);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const getAllPermissionTypes = async (req, res, next) => {
    try {
        const permission = await permissionRepo.getAllPermissionTypes();
        res.status(200).json(permission);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const getPermissionTypeByUserSystemScreen = async (req, res, next) => {
    try {
        const { user_id, system_id, screen_path } = req.params;
        const permission = await permissionRepo.getPermissionTypeByUserSystemScreen(user_id, system_id, screen_path);
        res.status(200).json(permission);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

module.exports = {
    getAllPermissions,
    permissionsByRoleDept,
    savePermissions,
    getAllPermissionTypes,
    getPermissionTypeByUserSystemScreen
}