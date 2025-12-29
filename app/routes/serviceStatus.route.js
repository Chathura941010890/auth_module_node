/**
 * Service Status Routes - Endpoints for checking the status of Redis and Kafka services
 * Also includes Redis cache management endpoints
 */
const express = require('express');
const router = express.Router();
const serviceStatusController = require('../controllers/serviceStatus.controller');

/**
 * @swagger
 * /status/redis:
 *   get:
 *     summary: Check Redis service status
 *     description: Returns the status and connection details of the Redis service
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: Redis is connected and responsive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 message:
 *                   type: string
 *                   example: Redis is connected and responsive
 *                 details:
 *                   type: object
 *       503:
 *         description: Redis connection failed
 */
router.get('/status/redis', serviceStatusController.getRedisStatus);

/**
 * @swagger
 * /status/kafka:
 *   get:
 *     summary: Check Kafka service status
 *     description: Returns the status and connection details of the Kafka service
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: Kafka is connected and responsive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 message:
 *                   type: string
 *                   example: Kafka is connected and responsive
 *                 details:
 *                   type: object
 *       503:
 *         description: Kafka connection failed
 */
router.get('/status/kafka', serviceStatusController.getKafkaStatus);

/**
 * @swagger
 * /status/redis/cache:
 *   get:
 *     summary: Get all Redis cache keys
 *     description: Returns a list of all keys in the Redis cache with their TTL and value previews
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Successfully retrieved cache keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 message:
 *                   type: string
 *                   example: Retrieved 42 cache keys
 *                 keys:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: string
 *                       ttl:
 *                         type: string
 *                       type:
 *                         type: string
 *                       size:
 *                         type: number
 *                       valuePreview:
 *                         type: string
 *       503:
 *         description: Failed to retrieve cache keys
 */
router.get('/redis/cache', serviceStatusController.getAllCacheKeys);

/**
 * @swagger
 * /status/redis/cache/{key}:
 *   delete:
 *     summary: Delete a specific Redis cache key
 *     description: Deletes a specific key from the Redis cache
 *     tags: [Cache Management]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: The Redis cache key to delete
 *     responses:
 *       200:
 *         description: Successfully deleted the cache key
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 message:
 *                   type: string
 *                   example: Successfully deleted key 'users:123' from Redis cache
 *       404:
 *         description: The specified key was not found
 *       503:
 *         description: Failed to delete the cache key
 */
router.delete('/redis/cache/:key', serviceStatusController.deleteCacheKey);

module.exports = router;
