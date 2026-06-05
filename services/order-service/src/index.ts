import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import {Order} from './models/Order';
import {createProducer, createConsumer, TOPICS, getKafka, OrderCreatedEvent} from '@shop/shared';
import {publishToQueue, QUEUES} from '@shop/shared';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4003;

async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set in .env');
    await mongoose.connect(uri);
    console.log('[order-service] MongoDB connected');
}

app.get('/health', (_req, res) => res.json({status: 'ok', service: 'order-service'}));

// Create order
app.post('/orders', async (req, res) => {
    try {
        const order = await Order.create(req.body);

        // Emit order.created to Kafka
        await OrderCreatedEvent.publish({
            id: order.id,
            userId: order.userId,
            items: order.items.map(i => ({
                productId: i.productId.toString(),
                quantity: i.quantity,
                price: i.unitPrice
            })),
            total: order.total,
            status: order.status,
        })

        // Queue order confirmation email
        try {
            await publishToQueue(QUEUES.ORDER_CONFIRMATION, {
                orderId: order.id,
                orderNumber: order.orderNumber,
                userId: order.userId,
                total: order.total,
                items: order.items,
            });
        } catch (err) {
            console.error('[order-service] RabbitMQ error:', err);
        }

        return res.status(201).json(order);
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

// Get orders (paginated)
app.get('/orders', async (req, res) => {
    try {
        const {userId, status} = req.query;
        const page = parseInt(String(req.query.page || '1'));
        const limit = parseInt(String(req.query.limit || '20'));
        const filter: Record<string, unknown> = {};
        if (userId) filter.userId = String(userId);
        if (status) filter.status = String(status);

        const [orders, total] = await Promise.all([
            Order.find(filter).sort({createdAt: -1}).skip((page - 1) * limit).limit(limit),
            Order.countDocuments(filter),
        ]);

        return res.json({orders, total, page, pages: Math.ceil(total / limit)});
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

app.get('/orders/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({error: 'Order not found'});
        return res.json(order);
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

app.get('/orders/number/:orderNumber', async (req, res) => {
    try {
        const order = await Order.findOne({orderNumber: req.params.orderNumber});
        if (!order) return res.status(404).json({error: 'Order not found'});
        return res.json(order);
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

app.patch('/orders/:id/status', async (req, res) => {
    try {
        const {status} = req.body;
        const order = await Order.findByIdAndUpdate(req.params.id, {status}, {new: true});
        if (!order) return res.status(404).json({error: 'Order not found'});

        try {
            const producer = await createProducer();
            await producer.send({
                topic: TOPICS.ORDER_UPDATED,
                messages: [{
                    value: JSON.stringify({
                        type: TOPICS.ORDER_UPDATED,
                        payload: {id: order.id, status, updatedAt: new Date().toISOString()}
                    })
                }],
            });
            await producer.disconnect();
        } catch (err) {
            console.error('[order-service] Kafka error:', err);
        }

        return res.json(order);
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

app.patch('/orders/:id/payment', async (req, res) => {
    try {
        const {transactionId, status, provider} = req.body;
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            {
                'payment.transactionId': transactionId,
                'payment.status': status,
                'payment.provider': provider,
                'payment.processedAt': new Date(),
                status: status === 'paid' ? 'confirmed' : 'pending',
            },
            {new: true}
        );
        if (!order) return res.status(404).json({error: 'Order not found'});

        try {
            const producer = await createProducer();
            await producer.send({
                topic: TOPICS.PAYMENT_PROCESSED,
                messages: [{
                    value: JSON.stringify({
                        type: TOPICS.PAYMENT_PROCESSED,
                        payload: {orderId: order.id, amount: order.total, provider, status, transactionId}
                    })
                }],
            });
            await producer.disconnect();
        } catch (err) {
            console.error('[order-service] Kafka error:', err);
        }

        return res.json(order);
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

async function startKafkaConsumer() {
    try {
        // Create topics if they don't exist yet
        const admin = getKafka().admin();
        await admin.connect();
        await admin.createTopics({
            waitForLeaders: true,
            topics: [
                {topic: TOPICS.ORDER_CREATED, numPartitions: 3, replicationFactor: 1},
                {topic: TOPICS.ORDER_UPDATED, numPartitions: 3, replicationFactor: 1},
                {topic: TOPICS.PAYMENT_PROCESSED, numPartitions: 3, replicationFactor: 1},
            ],
        });
        await admin.disconnect();

        const consumer = await createConsumer('order-service-group');
        await consumer.subscribe({topics: [TOPICS.PAYMENT_PROCESSED], fromBeginning: false});
        await consumer.run({
            eachMessage: async ({message}) => {
                if (!message.value) return;
                const event = JSON.parse(message.value.toString());
                console.log('[order-service] Event received:', event.type);
            },
        });
        console.log('[order-service] Kafka consumer started');
    } catch (err) {
        console.error('[order-service] Kafka consumer error:', err);
    }
}

async function bootstrap() {
    await connectDB();
    app.listen(PORT, () => console.log(`[order-service] Running on port ${PORT}`));
    await startKafkaConsumer();
}

bootstrap().catch(console.error);
