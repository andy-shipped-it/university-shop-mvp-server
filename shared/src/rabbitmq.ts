import amqp, { Channel, ChannelModel } from 'amqplib';

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export async function getRabbitChannel(): Promise<Channel> {
    if (!channel) {
        const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
        connection = await amqp.connect(url);
        channel = await connection.createChannel();
    }
    return channel as Channel;
}

export async function publishToQueue(
    queue: string,
    message: object
): Promise<void> {
    const ch = await getRabbitChannel();
    await ch.assertQueue(queue, { durable: true });
    ch.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        contentType: 'application/json',
    });
}

export async function consumeQueue(
    queue: string,
    handler: (message: object) => Promise<void>
): Promise<void> {
    const ch = await getRabbitChannel();
    await ch.assertQueue(queue, { durable: true });
    ch.prefetch(1);
    ch.consume(queue, async (msg) => {
        if (msg !== null) {
            try {
                const content = JSON.parse(msg.content.toString());
                await handler(content);
                ch.ack(msg);
            } catch (error) {
                console.error('Error processing message:', error);
                ch.nack(msg, false, false);
            }
        }
    });
}

export const QUEUES = {
    EMAIL_NOTIFICATIONS: 'email.notifications',
    ORDER_CONFIRMATION: 'order.confirmation',
    PAYMENT_WEBHOOKS: 'payment.webhooks',
    INVENTORY_UPDATES: 'inventory.updates',
    ADMIN_ALERTS: 'admin.alerts',
} as const;

export type QueueName = typeof QUEUES[keyof typeof QUEUES];

export async function closeRabbitConnection(): Promise<void> {
    if (channel) await channel.close();
    if (connection) await connection.close();
    channel = null;
    connection = null;
}