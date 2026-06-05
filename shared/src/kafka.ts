import { Kafka, Producer, Consumer, KafkaConfig } from 'kafkajs';

let kafka: Kafka | null = null;

export function getKafka(): Kafka {
  if (!kafka) {
    const config: KafkaConfig = {
      clientId: process.env.KAFKA_CLIENT_ID || 'shop-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    };
    kafka = new Kafka(config);
  }
  return kafka;
}

export async function createProducer(): Promise<Producer> {
  const producer = getKafka().producer();
  await producer.connect();
  return producer;
}

export async function createConsumer(groupId: string): Promise<Consumer> {
  const consumer = getKafka().consumer({ groupId });
  await consumer.connect();
  return consumer;
}

export const TOPICS = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DELETED: 'product.deleted',
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_PAID: 'order.paid',
  PAYMENT_PROCESSED: 'payment.processed',
} as const;

export type TopicName = typeof TOPICS[keyof typeof TOPICS];
