const ScreenRepository = require("../repositories/screen.repository");
const { getAllUserDataByEmail } = require("../repositories/user.repository");

const getAllScreens = async (req, res, next) => {
    try {
        const screens = await ScreenRepository.getAllScreens();
        res.status(200).json(screens);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const getAllScreensBySystem = async (req, res, next) => {
    try {

        const system_id = req.params.system_id;

        const screens = await ScreenRepository.getAllScreensBySystem(system_id);
        res.status(200).json(screens);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const createScreen = async (req, res, next) => {
    try {
        const { name, code, system_id, category, created_by, main_icon, secondary_icon } = req.body;

        if(system_id){
            const userData = await getAllUserDataByEmail(created_by);

            const systemHave = userData.UserSystems.find(item => item.System.id == system_id);

            const isSuperAdmin = userData.UserRoles.find(item => item.Role.description == "BackofficeSuperAdmin");
            
            if(!isSuperAdmin && !systemHave){
                throw new Error('Sorry! You do not have premissions to create screens in selected system.')
            }
        }

        const createdScreen = await ScreenRepository.createScreen(name, code, system_id, category, created_by, main_icon, secondary_icon );
        res.status(200).json(createdScreen);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const updateScreen = async (req, res, next) => {
    try {
        const updatedData = req.body;

        const updatedScreen = await ScreenRepository.updateScreen(updatedData);
        res.status(200).json(updatedScreen);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const archiveScreen = async (req, res, next) => {
    try {
        const screenId = req.body.id;
        const updated_by = req.body.updated_by;

        const archivedScreen = await ScreenRepository.archiveScreen(screenId, updated_by);
        res.status(200).json(archivedScreen);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

module.exports = {
    getAllScreens,
    getAllScreensBySystem,
    createScreen,
    updateScreen,
    archiveScreen
};
