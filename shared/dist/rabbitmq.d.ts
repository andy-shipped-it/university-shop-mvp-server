import { Channel } from 'amqplib';
export declare function getRabbitChannel(): Promise<Channel>;
export declare function publishToQueue(queue: string, message: object): Promise<void>;
export declare function consumeQueue(queue: string, handler: (message: object) => Promise<void>): Promise<void>;
export declare const QUEUES: {
    readonly EMAIL_NOTIFICATIONS: "email.notifications";
    readonly ORDER_CONFIRMATION: "order.confirmation";
    readonly PAYMENT_WEBHOOKS: "payment.webhooks";
    readonly INVENTORY_UPDATES: "inventory.updates";
    readonly ADMIN_ALERTS: "admin.alerts";
};
export type QueueName = typeof QUEUES[keyof typeof QUEUES];
export declare function closeRabbitConnection(): Promise<void>;
//# sourceMappingURL=rabbitmq.d.ts.map