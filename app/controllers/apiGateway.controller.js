const repo = require('../repositories/apiGateway.repository')

const getAllServices = async (req, res, next) => {
    try {
      const services = await repo.getAllServices();
      res.status(200).json(services);
    } catch (err) {
      res.status(500).send({
        message: err.message || 'Internal Server Error',
      });
    }
};

const getAllUnauthorizedPaths = async (req, res, next) => {
    try {
      const ups = await repo.getAllUnauthorizedPaths();
      res.status(200).json(ups);
    } catch (err) {
      res.status(500).send({
        message: err.message || 'Internal Server Error',
      });
    }
};

const createService = async (req, res, next) => {
    try {
        const name = req.body.name;
        const epId = req.body.epId;
        const epURL = req.body.epURL;
        const description = req.body.description;

      const ups = await repo.createService(name, epId, epURL, description);
      res.status(200).json(ups);
    } catch (err) {
        console.log(err);
      res.status(500).send({
        message: err.message || 'Internal Server Error',
      });
    }
};

const createUnauthorizedPath = async (req, res, next) => {
    try {

        const module = req.body.module;
        const path_name = req.body.path_name;

      const ups = await repo.createUnauthorizedPath(module, path_name);
      res.status(200).json(ups);
    } catch (err) {
      res.status(500).send({
        message: err.message || 'Internal Server Error',
      });
    }
};

const updateService = async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await repo.updateService(id, req.body);
        if (result === "Not found") {
            return res.status(404).json({ message: "Service not found" });
        }
        res.status(200).json({ message: "Service updated" });
    } catch (err) {
        res.status(500).send({
            message: err.message || 'Internal Server Error',
        });
    }
};

const deleteService = async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await repo.deleteService(id);
        if (result === "Not found") {
            return res.status(404).json({ message: "Service not found" });
        }
        res.status(200).json({ message: "Service deleted" });
    } catch (err) {
        res.status(500).send({
            message: err.message || 'Internal Server Error',
        });
    }
};

const updateUnauthorizedPath = async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await repo.updateUnauthorizedPath(id, req.body);
        if (result === "Not found") {
            return res.status(404).json({ message: "Unauthorized path not found" });
        }
        res.status(200).json({ message: "Unauthorized path updated" });
    } catch (err) {
        res.status(500).send({
            message: err.message || 'Internal Server Error',
        });
    }
};

const deleteUnauthorizedPath = async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await repo.deleteUnauthorizedPath(id);
        if (result === "Not found") {
            return res.status(404).json({ message: "Unauthorized path not found" });
        }
        res.status(200).json({ message: "Unauthorized path deleted" });
    } catch (err) {
        res.status(500).send({
            message: err.message || 'Internal Server Error',
        });
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
};