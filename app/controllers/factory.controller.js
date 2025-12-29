
const FactoryRepository = require("../repositories/factory.repository");

const getAllFactories = async (req, res, next) => {
    try {
        const factories = await FactoryRepository.getAllFactories();
        res.status(200).json(factories);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const getFactoryByID = async (req, res, next) => {
    try {

        const id = req.params.id;

        const factories = await FactoryRepository.getFactoryByID(id);
        res.status(200).json(factories);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const createFactory = async (req, res, next) => {
    try {
        const { name, code, country_id, created_by } = req.body;
        const createdFactory = await FactoryRepository.createFactory(name, code, country_id, created_by);
        res.status(200).json(createdFactory);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const updateFactory = async (req, res, next) => {
    try {
        const updatedData = req.body;

        const updatedFactory = await FactoryRepository.updateFactory(updatedData);
        res.status(200).json(updatedFactory);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const archiveFactory = async (req, res, next) => {
    try {
        const factoryId = req.body.id;
        const updated_by = req.body.updated_by;

        const archivedFactory = await FactoryRepository.archiveFactory(factoryId, updated_by);
        res.status(200).json(archivedFactory);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

// Fetch multiple factories by IDs (comma-separated)
 const getFactoriesByIDs = async (req, res, next) => {
    try {
        const ids = req.params.ids.split(',').map(id => id.trim()).filter(Boolean);
        if (!ids.length) return res.status(400).json({ message: 'No factory IDs provided' });
        const factories = await FactoryRepository.getFactoriesByIDs(ids);
        res.status(200).json({
            status: 'Success',
            data: factories
        });
    } catch (error) {
        res.status(error.statusCode || 400).json({
            status: 'Failure',
            message: error.message
        });
    }
};

module.exports = {
    getAllFactories,
    getFactoryByID,
    createFactory,
    updateFactory,
    archiveFactory,
    getFactoriesByIDs
};
