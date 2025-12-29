const SpecialFunctionRepository = require("../repositories/special.function.repository");
const { getAllUserDataByEmail } = require("../repositories/user.repository");

const getAllSpecialFunctions = async (req, res, next) => {
    try {
        const specialFunctions = await SpecialFunctionRepository.getAllSpecialFunctions();
        res.status(200).json(specialFunctions);
    } catch (err) {
        res.status(400).send({
            message: err.message || "Some error occurred!"
        });
    }
}

const createSpecialFunction = async (req, res, next) => {
    try {
        const { name, system_id, created_by } = req.body;

        if(system_id){
            const userData = await getAllUserDataByEmail(created_by);

            const systemHave = userData.UserSystems.find(item => item.System.id == system_id);

            const isSuperAdmin = userData.UserRoles.find(item => item.Role.description == "BackofficeSuperAdmin");
            
            if(!isSuperAdmin && !systemHave){
                throw new Error('Sorry! You do not have premissions to create special functions in selected system.')
            }
        }

        const createdSpecialFunction = await SpecialFunctionRepository.createSpecialFunction(name, system_id, created_by);
        res.status(200).json(createdSpecialFunction);
    } catch (err) {
        res.status(400).send({
            message: err.message || "Some error occurred!"
        });
    }
}

const updateSpecialFunction = async (req, res, next) => {
    try {
        const updatedData = req.body;

        const updatedSpecialFunction = await SpecialFunctionRepository.updateSpecialFunction(updatedData);
        res.status(200).json(updatedSpecialFunction);
    } catch (err) {
        res.status(400).send({
            message: err.message || "Some error occurred!"
        });
    }
}

const archiveSpecialFunction = async (req, res, next) => {
    try {
        const specialFunctionId = req.body.id;
        const updated_by = req.body.updated_by;

        const archivedSpecialFunction = await SpecialFunctionRepository.archiveSpecialFunction(specialFunctionId, updated_by);
        res.status(200).json(archivedSpecialFunction);
    } catch (err) {
        res.status(400).send({
            message: err.message || "Some error occurred!"
        });
    }
}

module.exports = {
    getAllSpecialFunctions,
    createSpecialFunction,
    updateSpecialFunction,
    archiveSpecialFunction
};
