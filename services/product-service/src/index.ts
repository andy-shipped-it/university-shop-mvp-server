import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import {Product} from './models/Product';
import {Category} from './models/Category';
import {createProducer, createConsumer, TOPICS, getKafka} from '@shop/shared';
import {publishToQueue, QUEUES} from '@shop/shared';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4002;

async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set in .env');
    await mongoose.connect(uri);
    console.log('[product-service] MongoDB connected');
}

// ─── Health ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({status: 'ok', service: 'product-service'}));

// ─── Categories ────────────────────────────────────────────────────────
app.get('/categories', async (_req, res) => {
    try {
        const categories = await Category.find({isActive: true});
        return res.json(categories);
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

app.get('/categories/:id', async (req, res) => {
    try {
        const cat = await Category.findById(req.params.id);
        if (!cat) return res.status(404).json({error: 'Category not found'});
        return res.json(cat);
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

app.post('/categories', async (req, res) => {
    try {
        const cat = await Category.create(req.body);
        return res.status(201).json(cat);
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

app.put('/categories/:id', async (req, res) => {
    try {
        const cat = await Category.findByIdAndUpdate(req.params.id, req.body, {new: true});
        if (!cat) return res.status(404).json({error: 'Category not found'});
        return res.json(cat);
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

app.delete('/categories/:id', async (req, res) => {
    try {
        await Category.findByIdAndUpdate(req.params.id, {isActive: false});
        return res.json({message: 'Category deactivated'});
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

// ─── Products ──────────────────────────────────────────────────────────
app.get('/products', async (req, res) => {
    try {
        // pagination
        const page = parseInt(String(req.query.page || '1'));
        const limit = parseInt(String(req.query.limit || '20'));
        const skip = (page - 1) * limit;

        // product filter
        const {categoryId, search, minPrice, maxPrice} = req.query;
        const filter: Record<string, unknown> = {isActive: true};

        // category filter
        if (categoryId) filter.categoryId = categoryId;

        // search query
        if (search) filter.$text = {$search: String(search)};

        // price filter
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) (filter.price as Record<string, number>).$gte = parseFloat(String(minPrice));
            if (maxPrice) (filter.price as Record<string, number>).$lte = parseFloat(String(maxPrice));
        }

        // find filtered, paginated products and count them
        const [products, total] = await Promise.all([
            Product.find(filter).populate('categoryId').skip(skip).limit(limit),
            Product.countDocuments(filter),
        ]);

        // return resulting products to API gateway
        return res.json({products, total, page, pages: Math.ceil(total / limit)});
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

app.get('/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('categoryId');
        if (!product) return res.status(404).json({error: 'Product not found'});
        return res.json(product);
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

app.get('/products/slug/:slug', async (req, res) => {
    try {
        const product = await Product.findOne({slug: req.params.slug, isActive: true}).populate('categoryId');
        if (!product) return res.status(404).json({error: 'Product not found'});
        return res.json(product);
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

app.post('/products', async (req, res) => {
    try {
        const product = await Product.create(req.body);
        try {
            const producer = await createProducer();
            await producer.send({
                topic: TOPICS.PRODUCT_CREATED,
                messages: [{
                    value: JSON.stringify({
                        type: TOPICS.PRODUCT_CREATED,
                        payload: {
                            id: product.id,
                            name: product.name,
                            price: product.price,
                            categoryId: product.categoryId,
                            stock: product.stock
                        }
                    })
                }],
            });
            await producer.disconnect();
        } catch (err) {
            console.error('[product-service] Kafka error:', err);
        }

        return res.status(201).json(product);
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

app.put('/products/:id', async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(req.params.id, req.body, {new: true}).populate('categoryId');
        if (!product) return res.status(404).json({error: 'Product not found'});
        try {
            const producer = await createProducer();
            await producer.send({
                topic: TOPICS.PRODUCT_UPDATED,
                messages: [{
                    value: JSON.stringify({
                        type: TOPICS.PRODUCT_UPDATED,
                        payload: {id: product.id, ...req.body}
                    })
                }],
            });
            await producer.disconnect();
        } catch (err) {
            console.error('[product-service] Kafka error:', err);
        }
        return res.json(product);
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

app.delete('/products/:id', async (req, res) => {
    try {
        await Product.findByIdAndUpdate(req.params.id, {isActive: false});
        try {
            const producer = await createProducer();
            await producer.send({
                topic: TOPICS.PRODUCT_DELETED,
                messages: [{value: JSON.stringify({type: TOPICS.PRODUCT_DELETED, payload: {id: req.params.id}})}],
            });
            await producer.disconnect();
        } catch (err) {
            console.error('[product-service] Kafka error:', err);
        }
        return res.json({message: 'Product deactivated'});
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
    }
});

// ─── Stock check ───────────────────────────────────────────────────────
app.post('/products/check-stock', async (req, res) => {
    try {
        const items: Array<{ productId: string; quantity: number }> = req.body.items;
        const results = await Promise.all(
            items.map(async ({productId, quantity}) => {
                const product = await Product.findById(productId);
                return {productId, available: product ? product.stock >= quantity : false, stock: product?.stock ?? 0};
            })
        );
        return res.json({results, allAvailable: results.every(r => r.available)});
    } catch (e: unknown) {
        return res.status(500).json({error: e instanceof Error ? e.message : 'Error'});
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
                {topic: TOPICS.PRODUCT_CREATED, numPartitions: 3, replicationFactor: 1},
                {topic: TOPICS.PRODUCT_UPDATED, numPartitions: 3, replicationFactor: 1},
                {topic: TOPICS.PRODUCT_DELETED, numPartitions: 3, replicationFactor: 1},
                {topic: TOPICS.ORDER_CREATED, numPartitions: 3, replicationFactor: 1},
            ],
        });
        await admin.disconnect();

        const consumer = await createConsumer('product-service-group');
        await consumer.subscribe({topics: [TOPICS.ORDER_CREATED], fromBeginning: false});
        await consumer.run({
            eachMessage: async ({message}) => {
                if (!message.value) return;
                const event = JSON.parse(message.value.toString());
                if (event.type === TOPICS.ORDER_CREATED) {
                    for (const item of event.payload.items) {
                        await Product.findByIdAndUpdate(item.productId, {$inc: {stock: -item.quantity}});
                    }
                    console.log('[product-service] Stock updated for order:', event.payload.id);
                }
            },
        });
        console.log('[product-service] Kafka consumer started');
    } catch (err) {
        console.error('[product-service] Kafka consumer error:', err);
    }
}

async function bootstrap() {
    await connectDB();
    app.listen(PORT, () => console.log(`[product-service] Running on port ${PORT}`));
    await startKafkaConsumer();
}

bootstrap().catch(console.error);
