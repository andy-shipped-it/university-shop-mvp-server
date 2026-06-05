import {createProducer, TOPICS} from "./kafka";

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

    // todo: subscribe()

    // todo: adapt all events to using this class
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

export interface OrderUpdatedEvent {
    type: 'order.updated';
    payload: {
        id: string;
        status: string;
        updatedAt: string;
    };
}

export interface ProductCreatedEvent {
    type: 'product.created';
    payload: {
        id: string;
        name: string;
        price: number;
        categoryId: string;
        stock: number;
    };
}

export interface ProductUpdatedEvent {
    type: 'product.updated';
    payload: {
        id: string;
        [key: string]: unknown;
    };
}

export interface PaymentProcessedEvent {
    type: 'payment.processed';
    payload: {
        orderId: string;
        amount: number;
        provider: string;
        status: 'success' | 'failed';
        transactionId?: string;
    };
}

export interface EmailNotificationMessage {
    to: string;
    subject: string;
    template: 'order_confirmation' | 'registration' | 'password_reset' | 'order_shipped';
    data: Record<string, unknown>;
}
