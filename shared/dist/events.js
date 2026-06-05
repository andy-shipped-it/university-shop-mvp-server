"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderCreatedEvent = exports.UserCreatedEvent = void 0;
const kafka_1 = require("./kafka");
class KafkaEvent {
    constructor(topic) {
        this.topic = topic;
    }
    async publish(payload) {
        const producer = await (0, kafka_1.createProducer)();
        await producer.send({
            topic: this.topic,
            messages: [{
                    value: JSON.stringify({ type: this.topic, payload })
                }]
        });
        await producer.disconnect();
    }
}
exports.UserCreatedEvent = new KafkaEvent(kafka_1.TOPICS.USER_CREATED);
exports.OrderCreatedEvent = new KafkaEvent(kafka_1.TOPICS.ORDER_CREATED);
