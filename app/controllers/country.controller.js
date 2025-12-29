const CountryRepository = require("../repositories/country.repository");

const getAllCountries = async (req, res, next) => {
    try {
        const countries = await CountryRepository.getAllCountries();
        res.status(200).json(countries);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const createCountry = async (req, res, next) => {
    try {

        const { name, code, created_by } = req.body;

        const createdCountry = await CountryRepository.createCountry(name, code, created_by);
        res.status(200).json(createdCountry);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const updateCountry = async (req, res, next) => {
    try {
        const updatedData = req.body;

        const updatedCountry = await CountryRepository.updateCountry(updatedData);
        res.status(200).json(updatedCountry);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

const archiveCountry = async (req, res, next) => {
    try {
        const countryId = req.body.id;
        const updated_by = req.body.updated_by;

        const archivedCountry = await CountryRepository.archiveCountry(countryId, updated_by);
        res.status(200).json(archivedCountry);
    } catch (err) {
        res.status(err.statusCode || 400).json({
            message: err.message || "Some error occurred!"
        });
    }
}

module.exports = {
    getAllCountries,
    createCountry,
    updateCountry,
    archiveCountry
};
