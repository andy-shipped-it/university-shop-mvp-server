import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import {User} from './models/User';
import {createConsumer, createProducer, getKafka, TOPICS, UserCreatedEvent} from '@shop/shared';
import {publishToQueue, QUEUES} from '@shop/shared';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4001;

// ─── MongoDB ───────────────────────────────────────────────────────────
async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set in .env');
    await mongoose.connect(uri);
    console.log('[user-service] MongoDB connected');
}

// ─── Internal REST Handlers ────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({status: 'ok', service: 'user-service'}));

app.post('/users/register', async (req, res) => {
    try {
        const {email, password, firstName, lastName, gdprConsent} = req.body;

        if (!gdprConsent) {
            return res.status(400).json({error: 'GDPR consent is required'});
        }

        const existing = await User.findOne({email});
        if (existing) return res.status(409).json({error: 'Email already in use'});

        const user = await User.create({
            email,
            password,
            firstName,
            lastName,
            gdprConsent,
            gdprConsentDate: new Date(),
        });

        // Publish to Kafka
        await UserCreatedEvent.publish({id: user.id, email: user.email, role: user.role, createdAt: user.createdAt})
        
        // Queue welcome email via RabbitMQ
        try {
            await publishToQueue(QUEUES.EMAIL_NOTIFICATIONS, {
                to: user.email,
                subject: 'Welcome to the Shop!',
                template: 'registration',
                data: {firstName: user.firstName},
            });
        } catch (err) {
            console.error('[user-service] RabbitMQ publish error:', err);
        }

        return res.status(201).json(user.toJSON());
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({error: msg});
    }
});

app.post('/users/authenticate', async (req, res) => {
    try {
        const {email, password} = req.body;
        const user = await User.findOne({email, isActive: true}).select('+password');
        if (!user) return res.status(401).json({error: 'Invalid credentials'});

        const valid = await user.comparePassword(password);
        if (!valid) return res.status(401).json({error: 'Invalid credentials'});

        return res.json(user.toJSON());
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({error: msg});
    }
});

app.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({error: 'User not found'});
        return res.json(user.toJSON());
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({error: msg});
    }
});

app.put('/users/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, {new: true, runValidators: true});
        if (!user) return res.status(404).json({error: 'User not found'});
        return res.json(user.toJSON());
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({error: msg});
    }
});

app.delete('/users/:id', async (req, res) => {
    try {
        // GDPR: anonymize instead of hard delete
        const user = await User.findByIdAndUpdate(req.params.id, {
            email: `deleted_${req.params.id}@deleted.invalid`,
            firstName: 'Deleted',
            lastName: 'User',
            isActive: false,
            address: undefined,
        }, {new: true});
        if (!user) return res.status(404).json({error: 'User not found'});
        return res.json({message: 'User anonymized (GDPR compliant)'});
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({error: msg});
    }
});

app.get('/users', async (req, res) => {
    try {
        const page = parseInt(String(req.query.page) || '1');
        const limit = parseInt(String(req.query.limit) || '20');
        const skip = (page - 1) * limit;
        const users = await User.find({isActive: true}).skip(skip).limit(limit);
        const total = await User.countDocuments({isActive: true});
        return res.json({users: users.map(u => u.toJSON()), total, page, pages: Math.ceil(total / limit)});
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({error: msg});
    }
});

// ─── Kafka Consumer ────────────────────────────────────────────────────
async function startKafkaConsumer() {
    try {
        const admin = getKafka().admin();
        await admin.connect();
        await admin.createTopics({
            waitForLeaders: true,
            topics: [
                {topic: TOPICS.USER_CREATED, numPartitions: 3, replicationFactor: 1},
                {topic: TOPICS.ORDER_CREATED, numPartitions: 3, replicationFactor: 1},
            ],
        });
        await admin.disconnect();

        const consumer = await createConsumer('user-service-group');
        await consumer.subscribe({topics: [TOPICS.ORDER_CREATED], fromBeginning: false});
        await consumer.run({
            eachMessage: async ({topic, message}) => {
                if (!message.value) return;
                const event = JSON.parse(message.value.toString());
                console.log(`[user-service] Received event on ${topic}:`, event.type);
            },
        });
        console.log('[user-service] Kafka consumer started');
    } catch (err) {
        console.error('[user-service] Kafka consumer error:', err);
    }
}

// ─── Bootstrap ────────────────────────────────────────────────────────
async function bootstrap() {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`[user-service] Running on port ${PORT}`);
    });
    await startKafkaConsumer();
}

bootstrap().catch(console.error);
