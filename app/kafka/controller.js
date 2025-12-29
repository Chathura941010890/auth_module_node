const KafkaProducer = require('./producer');
const KafkaProducerSSE = require('./producerSSE')

const kafkaProducer = new KafkaProducer(); // Singleton instance
const kafkaProducerSSE = new KafkaProducerSSE(); // Singleton instance

const registerDeviceTokensFCM = async (data) => {
    try {
        const messages = [data];
        await kafkaProducer.produce("register_device_tokens", messages);
        console.log("Register token request produced successfully!");
    } catch (error) {
        console.log(error);
    } 
};

const sendMessageToKafkForEmail = async (data) => {
    try {
        const messages = [data];
        await kafkaProducer.produce("auth_email_notification", messages);
        console.log("Email produced successfully!");
    } catch (error) {
        console.log(error);
    }
};

const sendMessageToKafkaForNotification = async (data) => {
    try {
        const messages = [data];
        await kafkaProducer.produce("auth_notification", messages);

        console.log("Notification produces successfully!");
        
    } catch (error) {
        console.log(error);
    }
};

const sendDowntimeSSEAlert = async (data) => {
    try {
        const messages = [data];
        await kafkaProducerSSE.produce("downtime_sse_alert", messages);
        console.log("SSE Alert produced successfully!");
    } catch (error) {
        console.log(error);
    }
};

module.exports = {
    registerDeviceTokensFCM,
    sendMessageToKafkForEmail,
    sendMessageToKafkaForNotification,
    sendDowntimeSSEAlert
}