"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEUES = void 0;
exports.getRabbitChannel = getRabbitChannel;
exports.publishToQueue = publishToQueue;
exports.consumeQueue = consumeQueue;
exports.closeRabbitConnection = closeRabbitConnection;
const amqplib_1 = __importDefault(require("amqplib"));
let connection = null;
let channel = null;
async function getRabbitChannel() {
    if (!channel) {
        const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
        connection = await amqplib_1.default.connect(url);
        channel = await connection.createChannel();
    }
    return channel;
}
async function publishToQueue(queue, message) {
    const ch = await getRabbitChannel();
    await ch.assertQueue(queue, { durable: true });
    ch.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        contentType: 'application/json',
    });
}
async function consumeQueue(queue, handler) {
    const ch = await getRabbitChannel();
    await ch.assertQueue(queue, { durable: true });
    ch.prefetch(1);
    ch.consume(queue, async (msg) => {
        if (msg !== null) {
            try {
                const content = JSON.parse(msg.content.toString());
                await handler(content);
                ch.ack(msg);
            }
            catch (error) {
                console.error('Error processing message:', error);
                ch.nack(msg, false, false);
            }
        }
    });
}
exports.QUEUES = {
    EMAIL_NOTIFICATIONS: 'email.notifications',
    ORDER_CONFIRMATION: 'order.confirmation',
    PAYMENT_WEBHOOKS: 'payment.webhooks',
    INVENTORY_UPDATES: 'inventory.updates',
    ADMIN_ALERTS: 'admin.alerts',
};
async function closeRabbitConnection() {
    if (channel)
        await channel.close();
    if (connection)
        await connection.close();
    channel = null;
    connection = null;
}
