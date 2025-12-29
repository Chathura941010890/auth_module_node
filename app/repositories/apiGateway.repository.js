const Service = require('../models/Service.model')
const UnauthorizedPath = require('../models/unauthorizedPath.model')
const sequelize = require("../database/indexSR.js");
const {  sendMessageToKafkaForNotification } = require('../kafka/controller.js');

const getAllServices = async () => {
    try{
        const services = await Service.findAll();

        return services;
    }
    catch(e){
        throw new Error(e.message)
    }
}

const getAllUnauthorizedPaths = async () => {
    try{
        const ups = await UnauthorizedPath.findAll({
             order: [['module', 'ASC']] 
        });

        let returnUPS = ups.map(element => {
            return {
                ...element.toJSON(),
                path_name: "** Hidden for better security **"
            }
        });

        return returnUPS;
    }
    catch(e){
        throw new Error(e.message)
    }
}

const createService = async (name, epId, epURL, description) => {
    const t = await sequelize.transaction();
    try {
        // Check for duplicate name
        const existing = await Service.findOne({ where: { name } });
        if (existing) {
            throw new Error('A service with this name already exists');
        }
        await Service.create({
            name: name,
            endpointId: epId,
            endpointUrl: epURL,
            description: description
        }, { transaction: t });
        await t.commit();

        //Send notification
        // const notificationObjTemp = {
        //     emails: [created_by] || [],
        //     title: `Master Data Creation`,
        //     body: `${created_by} has created a new backend micro service - ${name} & URL - ${epURL}`,      data: { 
        //     type: 'info',
        //     system: "User Module"
        //     },
        // };

        // sendMessageToKafkaForNotification(notificationObjTemp).catch(error => {
        //     logger.error('Notification sending failed:', error);
        // });


        return "Success";
    } catch (e) {
        await t.rollback();
        throw new Error(e.message);
    }
}

const createUnauthorizedPath = async (module, path_name) => {
    const t = await sequelize.transaction();
    try{
        const ups = await UnauthorizedPath.create({
            module : module,
            path_name : path_name,
        }, {transaction : t})

        await t.commit();
        return "Success";
    }
    catch(e){
        await t.rollback();
        throw new Error(e.message)
    }
}

const updateService = async (id, { name, endpointId, endpointUrl, description }) => {
    const t = await sequelize.transaction();
    try {
        // Check for duplicate name (excluding self)
        if (name) {
            const existing = await Service.findOne({ where: { name, id: { [Service.sequelize.Op.ne]: id } } });
            if (existing) {
                throw new Error('A service with this name already exists');
            }
        }
        const [updated] = await Service.update({
            name,
            endpointId,
            endpointUrl,
            description
        }, { where: { id }, transaction: t });
        await t.commit();
        return updated ? "Success" : "Not found";
    } catch (e) {
        await t.rollback();
        throw new Error(e.message);
    }
};

const deleteService = async (id) => {
    const t = await sequelize.transaction();
    try {
        const deleted = await Service.destroy({ where: { id }, transaction: t });
        await t.commit();
        return deleted ? "Success" : "Not found";
    } catch (e) {
        await t.rollback();
        throw new Error(e.message);
    }
};

const updateUnauthorizedPath = async (id, { module, path_name, description }) => {
    const t = await sequelize.transaction();
    try {
        const [updated] = await UnauthorizedPath.update({
            module,
            path_name,
            description
        }, { where: { id }, transaction: t });
        await t.commit();
        return updated ? "Success" : "Not found";
    } catch (e) {
        await t.rollback();
        throw new Error(e.message);
    }
};

const deleteUnauthorizedPath = async (id) => {
    const t = await sequelize.transaction();
    try {
        const deleted = await UnauthorizedPath.destroy({ where: { id }, transaction: t });
        await t.commit();
        return deleted ? "Success" : "Not found";
    } catch (e) {
        await t.rollback();
        throw new Error(e.message);
    }
};

module.exports = {
    getAllServices,
    getAllUnauthorizedPaths,
    createService,
    createUnauthorizedPath,
    updateService,
    deleteService,
    updateUnauthorizedPath,
    deleteUnauthorizedPath
}
