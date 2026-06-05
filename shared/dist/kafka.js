"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOPICS = void 0;
exports.getKafka = getKafka;
exports.createProducer = createProducer;
exports.createConsumer = createConsumer;
const kafkajs_1 = require("kafkajs");
let kafka = null;
function getKafka() {
    if (!kafka) {
        const config = {
            clientId: process.env.KAFKA_CLIENT_ID || 'shop-service',
            brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        };
        kafka = new kafkajs_1.Kafka(config);
    }
    return kafka;
}
async function createProducer() {
    const producer = getKafka().producer();
    await producer.connect();
    return producer;
}
async function createConsumer(groupId) {
    const consumer = getKafka().consumer({ groupId });
    await consumer.connect();
    return consumer;
}
exports.TOPICS = {
    USER_CREATED: 'user.created',
    USER_UPDATED: 'user.updated',
    PRODUCT_CREATED: 'product.created',
    PRODUCT_UPDATED: 'product.updated',
    PRODUCT_DELETED: 'product.deleted',
    ORDER_CREATED: 'order.created',
    ORDER_UPDATED: 'order.updated',
    ORDER_PAID: 'order.paid',
    PAYMENT_PROCESSED: 'payment.processed',
};
