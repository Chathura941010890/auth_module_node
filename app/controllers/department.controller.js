const DepartmentRepository = require("../repositories/department.repository");
const { getAllUserDataByEmail } = require("../repositories/user.repository");

const getAllDepartments = async (req, res, next) => {
    try {
        const departments = await DepartmentRepository.getAllDepartments();
        res.status(200).json(departments);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const createDepartment = async (req, res, next) => {
    try {
        const { name, code, system_id, created_by } = req.body;

        if(system_id){
            const userData = await getAllUserDataByEmail(created_by);

            const systemHave = userData.UserSystems.find(item => item.System.id == system_id);

            const isSuperAdmin = userData.UserRoles.find(item => item.Role.description == "BackofficeSuperAdmin");
            
            if(!isSuperAdmin && !systemHave){
                throw new Error('Sorry! You do not have premissions to create departments in selected system.')
            }
        }

        const createdDepartment = await DepartmentRepository.createDepartment(name, code, system_id, created_by);
        res.status(200).json(createdDepartment);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const updateDepartment = async (req, res, next) => {
    try {
        const updatedData = req.body;

        const updatedDepartment = await DepartmentRepository.updateDepartment(updatedData);
        res.status(200).json(updatedDepartment);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const archiveDepartment = async (req, res, next) => {
    try {
        const departmentId = req.body.id;
        const updated_by = req.body.updated_by;

        const archivedDepartment = await DepartmentRepository.archiveDepartment(departmentId, updated_by);
        res.status(200).json(archivedDepartment);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const getDepartmentsBySystem = async (req, res, next) => {
    try {
        const { systemName } = req.params;

        if (!systemName) {
            throw new AppError("System name is required!", 400);
        }

        const departments = await DepartmentRepository.getDepartmentsBySystem(systemName);
        res.status(200).json(departments);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!",
        });
    }
};

module.exports = {
    getAllDepartments,
    createDepartment,
    updateDepartment,
    archiveDepartment,
    getDepartmentsBySystem
};
