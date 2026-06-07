import {createConsumer, createProducer, TOPICS} from "./kafka";

class KafkaEvent<T> {
    constructor(
        private readonly topic: string,
    ) {
    }
    
    async publish(payload: T): Promise<void> {
        try {
            const producer = await createProducer();

            await producer.send({
                topic: this.topic,
                messages: [{
                    value: JSON.stringify({type: this.topic, payload})
                }]
            });

            await producer.disconnect();
        } catch (e) {
            console.error(this.topic + ' - Kafka publish error', e);
        }
    }

    async subscribe(groupId: string, handler: (payload: T) => Promise<void> | void): Promise<void> {
        try {
            const consumer = await createConsumer(groupId);

            await consumer.subscribe({topic: this.topic, fromBeginning: false});

            await consumer.run({
                eachMessage: async ({message}) => {
                    if (!message.value) return;

                    const event = JSON.parse(message.value.toString());
                    await handler(event.payload);
                }
            });
        } catch (e) {
            console.error(this.topic + ' - Kafka subscribe error', e);
        }
    }

}

export const UserCreatedEvent = new KafkaEvent<{
    id: string;
    email: string;
    role: string;
    createdAt: Date;
}>(TOPICS.USER_CREATED);

export const OrderCreatedEvent = new KafkaEvent<{
    id: string;
    userId: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
    total: number;
    status: string;
}>(TOPICS.ORDER_CREATED)

export const OrderUpdatedEvent = new KafkaEvent<{
    id: string;
    status: string;
    updatedAt: string;
}>(TOPICS.ORDER_UPDATED);

export const ProductCreatedEvent = new KafkaEvent<{
    id: string;
    name: string;
    price: number;
    categoryId: string;
    stock: number;
}>(TOPICS.PRODUCT_CREATED);

export const ProductUpdatedEvent = new KafkaEvent<{
    id: string;
    [key: string]: unknown;
}>(TOPICS.PRODUCT_UPDATED);

export const ProductDeletedEvent = new KafkaEvent<{
    id: string;
}>(TOPICS.PRODUCT_DELETED);

export const PaymentProcessedEvent = new KafkaEvent<{
    orderId: string;
    amount: number;
    provider: string;
    status: 'success' | 'failed';
    transactionId?: string;
}>(TOPICS.PAYMENT_PROCESSED);

export interface EmailNotificationMessage {
    to: string;
    subject: string;
    template: 'order_confirmation' | 'registration' | 'password_reset' | 'order_shipped';
    data: Record<string, unknown>;
}
