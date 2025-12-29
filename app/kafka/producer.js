const  {kafka}  = require('./kafkaClient');
const { safeJsonStringify } = require('../utils/jsonSecurityUtils');

class KafkaProducer {
    constructor() {
        if (KafkaProducer.instance) {
            return KafkaProducer.instance;
        }
        
        this.producer = null;
        this.connected = false;
        this.connecting = false;
        KafkaProducer.instance = this;
    }

    async connect() {
        if (this.connected) {
            return;
        }

        if (this.connecting) {
            // Wait for the existing connection attempt to complete
            await new Promise(resolve => {
                const checkConnection = setInterval(() => {
                    if (this.connected || !this.connecting) {
                        clearInterval(checkConnection);
                        resolve();
                    }
                }, 100);
            });
            return;
        }

        try {
            this.connecting = true;
            if (!this.producer) {
                this.producer = kafka.producer({
                    maxInFlightRequests: 1,
                    idempotent: false,
                    transactionTimeout: 30000
                });
            }
            
            await this.producer.connect();
            this.connected = true;
            console.log('Kafka producer connected successfully (singleton)');
        } catch (error) {
            console.error('Failed to connect Kafka producer:', error);
            this.connected = false;
            throw error;
        } finally {
            this.connecting = false;
        }
    }

    async produce(topic, messages) {
        try {
            await this.connect();
            await this.producer.send({
                topic: topic,
                messages: messages.map(message => {
                    try {
                        return { value: safeJsonStringify(message) };
                    } catch (error) {
                        console.warn(`Failed to stringify message safely, skipping: ${error.message}`);
                        return { value: JSON.stringify({ error: 'Invalid message format' }) };
                    }
                }),
            });
        } catch (error) {
            console.error('Error producing message:', error);
            // Reset connection state on error
            this.connected = false;
        }
    }

    async disconnect() {
        if (this.connected && this.producer) {
            try {
                await this.producer.disconnect();
                this.connected = false;
                console.log('Kafka producer disconnected successfully');
            } catch (error) {
                console.error('Failed to disconnect Kafka producer:', error);
            }
        }
    }

    // Graceful shutdown
    async gracefulShutdown() {
        console.log('Initiating Kafka producer graceful shutdown...');
        await this.disconnect();
        KafkaProducer.instance = null;
    }
}

// Initialize singleton instance as null
KafkaProducer.instance = null;

module.exports = KafkaProducer;