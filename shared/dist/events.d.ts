declare class KafkaEvent<T> {
    private readonly topic;
    constructor(topic: string);
    publish(payload: T): Promise<void>;
}
export declare const UserCreatedEvent: KafkaEvent<{
    id: string;
    email: string;
    role: string;
    createdAt: Date;
}>;
export declare const OrderCreatedEvent: KafkaEvent<{
    id: string;
    userId: string;
    items: Array<{
        productId: string;
        quantity: number;
        price: number;
    }>;
    total: number;
    status: string;
}>;
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
export {};
//# sourceMappingURL=events.d.ts.map