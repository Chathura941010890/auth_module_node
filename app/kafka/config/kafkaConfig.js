const { Kafka } = require('kafkajs');

const kafkaConfig = {
  clientId: 'inqube-notofication-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
};

const kafka = new Kafka(kafkaConfig);

const kafkaConfigSSE = {
  clientId: 'inqube-api-gateway',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
};

const kafkaSSE = new Kafka(kafkaConfigSSE);

module.exports = {
  kafkaConfig,
  kafka,
  kafkaConfigSSE,
  kafkaSSE
};