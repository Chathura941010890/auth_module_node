const RoleRepository = require("../repositories/role.repository");
const { getAllUserDataByEmail } = require("../repositories/user.repository");

const getAllRoles = async (req, res, next) => {
    try {
        const roles = await RoleRepository.getAllRoles();
        res.status(200).json(roles);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const createRole = async (req, res, next) => {
    try {
        const { description, code, system_id, created_by } = req.body;

        if(system_id){
            const userData = await getAllUserDataByEmail(created_by);

            const systemHave = userData.UserSystems.find(item => item.System.id == system_id);

            const isSuperAdmin = userData.UserRoles.find(item => item.Role.description == "BackofficeSuperAdmin");
            
            if(!isSuperAdmin && !systemHave){
                throw new Error('Sorry! You do not have premissions to create roles in selected system.')
            }
        }

        const createdRole = await RoleRepository.createRole(description, code, system_id, created_by);
        res.status(200).json(createdRole);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const updateRole = async (req, res, next) => {
    try {
        const updatedData = req.body;

        const updatedRole = await RoleRepository.updateRole(updatedData);
        res.status(200).json(updatedRole);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const archiveRole = async (req, res, next) => {
    try {
        const roleId = req.body.id;
        const updated_by = req.body.updated_by;

        const archivedRole = await RoleRepository.archiveRole(roleId, updated_by);
        res.status(200).json(archivedRole);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

module.exports = {
    getAllRoles,
    createRole,
    updateRole,
    archiveRole
};
