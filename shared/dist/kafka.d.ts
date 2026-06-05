import { Kafka, Producer, Consumer } from 'kafkajs';
export declare function getKafka(): Kafka;
export declare function createProducer(): Promise<Producer>;
export declare function createConsumer(groupId: string): Promise<Consumer>;
export declare const TOPICS: {
    readonly USER_CREATED: "user.created";
    readonly USER_UPDATED: "user.updated";
    readonly PRODUCT_CREATED: "product.created";
    readonly PRODUCT_UPDATED: "product.updated";
    readonly PRODUCT_DELETED: "product.deleted";
    readonly ORDER_CREATED: "order.created";
    readonly ORDER_UPDATED: "order.updated";
    readonly ORDER_PAID: "order.paid";
    readonly PAYMENT_PROCESSED: "payment.processed";
};
export type TopicName = typeof TOPICS[keyof typeof TOPICS];
//# sourceMappingURL=kafka.d.ts.map