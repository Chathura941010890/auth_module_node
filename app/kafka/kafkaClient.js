const { Kafka } = require('kafkajs');
const { safeGetEnv } = require('../utils/commandSecurityUtils');

const kafka = new Kafka({
    clientId: 'inqube-notification-service',
    brokers: [safeGetEnv('KAFKA_BROKER', 'localhost:9092', { 
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\.\-]+:\d+$/
    })],
});

const kafkaSSE = new Kafka({
    clientId: 'inqube-api-gateway',
    brokers: [safeGetEnv('KAFKA_BROKER', 'localhost:9092', { 
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\.\-]+:\d+$/
    })],
});


module.exports = {
    kafka,
    kafkaSSE
};
