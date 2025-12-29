const CustomerRepository = require("../repositories/customer.repository");

const getAllCustomers = async (req, res, next) => {
    try {
        const customers = await CustomerRepository.getAllCustomers();
        res.status(200).json(customers);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const createCustomer = async (req, res, next) => {
    try {
        const createed = await CustomerRepository.createCustomer(req);
        res.status(200).json(createed);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const updateCustomer = async (req, res, next) => {
    try {
        const updatedData = req.body;

        const updatedCustomer = await CustomerRepository.updateCustomer(updatedData);
        res.status(200).json(updatedCustomer);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const getById = async (req, res, next) => {
    try {
        const id = req.params.id;

        const Customer = await CustomerRepository.getById(id);
        res.status(200).json(Customer);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

 const getCustomersByIDs = async (req, res, next) => {
    try {
        const ids = req.params.ids.split(',').map(id => id.trim()).filter(Boolean);
        if (!ids.length) return res.status(400).json({ message: 'No customer IDs provided' });
        const custmers = await CustomerRepository.getCustomersByIDs(ids);
        res.status(200).json({
            status: 'Success',
            data: custmers
        });
    } catch (error) {
        res.status(error.statusCode || 400).json({
            status: 'Failure',
            message: error.message
        });
    }
};

module.exports = {
    getAllCustomers,
    createCustomer,
    updateCustomer,
    getById,
    getCustomersByIDs
}

