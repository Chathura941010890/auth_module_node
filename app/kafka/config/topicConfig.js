const { kafka, kafkaSSE } = require('./kafkaConfig');

const admin = kafka.admin();
const adminSSE = kafkaSSE.admin();

const configureTopic = async () => {
  try {
    await admin.connect();

    // Define topic configuration
    const topicConfig = {
      topics: [
        {
          topic: 'register_device_tokens', // The name of the topic
          numPartitions: 1, // Number of partitions
          replicationFactor: 1, // Replication factor
          configEntries: [
            { name: 'cleanup.policy', value: 'delete' }, // Configuration entry (optional)
            { name: 'retention.ms', value: '86400000' } // Configuration entry (optional)
          ]
        },
        {
          topic: 'auth_email_notification', // The name of the topic
          numPartitions: 1, // Number of partitions
          replicationFactor: 1, // Replication factor
          configEntries: [
            { name: 'cleanup.policy', value: 'delete' }, // Configuration entry (optional)
            { name: 'retention.ms', value: '86400000' } // Configuration entry (optional)
          ]
        },
        {
          topic: 'auth_notification', // The name of the topic
          numPartitions: 1, // Number of partitions
          replicationFactor: 1, // Replication factor
          configEntries: [
            { name: 'cleanup.policy', value: 'delete' }, // Configuration entry (optional)
            { name: 'retention.ms', value: '86400000' } // Configuration entry (optional)
          ]
        },
        {
          topic: 'downtime_sse_alert', // The name of the topic
          numPartitions: 1, // Number of partitions
          replicationFactor: 1, // Replication factor
          configEntries: [
            { name: 'cleanup.policy', value: 'delete' }, // Configuration entry (optional)
            { name: 'retention.ms', value: '86400000' } // Configuration entry (optional)
          ]
        }
      ]
    };

    // Create or alter the topic with the given configuration
    await admin.createTopics(topicConfig);

    console.log('Topic configured successfully');
  } catch (error) {
    console.error('Error configuring topic:', error);
  } finally {
    await admin.disconnect();
  }
};

const configureTopicSSE = async () => {
  try {
    await adminSSE.connect();

    // Define topic configuration
    const topicConfig = {
      topics: [
        {
          topic: 'downtime_sse_alert', // The name of the topic
          numPartitions: 1, // Number of partitions
          replicationFactor: 1, // Replication factor
          configEntries: [
            { name: 'cleanup.policy', value: 'delete' }, // Configuration entry (optional)
            { name: 'retention.ms', value: '86400000' } // Configuration entry (optional)
          ]
        }
      ]
    };

    // Create or alter the topic with the given configuration
    await adminSSE.createTopics(topicConfig);

    console.log('Topic configured successfully');
  } catch (error) {
    console.error('Error configuring topic:', error);
  } finally {
    await adminSSE.disconnect();
  }
};


module.exports = {
  configureTopic,
  configureTopicSSE
};