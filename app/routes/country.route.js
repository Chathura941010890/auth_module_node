const express = require('express');
const countryRouter = express.Router();
const CountryController = require('../controllers/country.controller');

/**
 * @swagger
 * tags:
 *   name: Countries
 *   description: Country management endpoints
 */

/**
 * @swagger
 * /countries/getAllCountries:
 *   get:
 *     summary: Get all countries
 *     tags: [Countries]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of countries
 */
countryRouter.get('/countries/getAllCountries',  CountryController.getAllCountries);

/**
 * @swagger
 * /countries/createCountry:
 *   post:
 *     summary: Create a new country
 *     tags: [Countries]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Country created
 */
countryRouter.post('/countries/createCountry',  CountryController.createCountry);

/**
 * @swagger
 * /countries/updateCountry:
 *   put:
 *     summary: Update a country
 *     tags: [Countries]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Country updated
 */
countryRouter.put('/countries/updateCountry',  CountryController.updateCountry);

/**
 * @swagger
 * /countries/archiveCountry:
 *   put:
 *     summary: Archive a country
 *     tags: [Countries]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Country archived
 */
countryRouter.put('/countries/archiveCountry',  CountryController.archiveCountry);

module.exports = countryRouter;
