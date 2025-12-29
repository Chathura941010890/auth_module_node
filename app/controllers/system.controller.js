const SystemRepository = require("../repositories/system.repository");
const { getAllUserDataByEmail } = require("../repositories/user.repository");

const getAllSystems = async (req, res, next) => {
    try {
        const systems = await SystemRepository.getAllSystems();
        res.status(200).json(systems);
    } catch (err) {
        res.status(400).send({
            message: err.message || "Some error occurred!"
        });
    }
}

const createSystem = async (req, res, next) => {
    try {
        const { name, code, url, created_by } = req.body;
        const createdSystem = await SystemRepository.createSystem(name, code, url, created_by);
        res.status(200).json(createdSystem);
        
    } catch (err) {
        res.status(400).send({
            message: err.message || "Some error occurred!"
        });
    }
}

const updateSystem = async (req, res, next) => {
    try {
        const updatedData = req.body;

        if(updatedData.updated_by){
            const userData = await getAllUserDataByEmail(updatedData.updated_by);
        
            const systemHave = userData.UserSystems.find(item => item.System.id == updatedData.id);
            const isSuperAdmin = userData.UserRoles.find(item => item.Role.description == "BackofficeSuperAdmin");
            
            if(!isSuperAdmin && !systemHave){
                throw new Error('Sorry! You do not have premissions to update this system data.')
            }
        }

        const updatedSystem = await SystemRepository.updateSystem(updatedData);
        res.status(200).json(updatedSystem);
    } catch (err) {
        res.status(400).send({
            message: err.message || "Some error occurred!"
        });
    }
}

const archiveSystem = async (req, res, next) => {
    try {
        const systemId = req.body.id;
        const updated_by = req.body.updated_by;

        if(updated_by){
            const userData = await getAllUserDataByEmail(updated_by);

            const systemHave = userData.UserSystems.find(item => item.System.id == systemId);

            const isSuperAdmin = userData.UserRoles.find(item => item.Role.description == "BackofficeSuperAdmin");
            
            if(!isSuperAdmin && !systemHave){
                throw new Error('Sorry! You do not have premissions to update this system data.')
            }
        }

        const archiveSystem = await SystemRepository.archiveSystem(systemId, updated_by);
        res.status(200).json(archiveSystem);
    } catch (err) {
        res.status(400).send({
            message: err.message || "Some error occurred!"
        });
    }
}

module.exports = {
    getAllSystems,
    createSystem,
    updateSystem,
    archiveSystem
}