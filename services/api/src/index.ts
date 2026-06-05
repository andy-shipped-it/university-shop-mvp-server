import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import {ApolloServer} from '@apollo/server';
import {expressMiddleware} from '@apollo/server/express4';
import {ApolloServerPluginDrainHttpServer} from '@apollo/server/plugin/drainHttpServer';
import {json} from 'body-parser';
import http from 'http';
import MongoStore from 'connect-mongo';
import {typeDefs} from './schema/typeDefs';
import {resolvers} from './resolvers';
import {configurePassport} from './middleware/passport';

const app = express();
const httpServer = http.createServer(app);

// ─── Security middleware ───────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
}));

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}));

app.use(cookieParser());
app.use(json());

// ─── Rate limiting ────────────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/graphql', limiter);

// ─── Auth rate limit (stricter) ────────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many authentication attempts, please try again later',
});

// ─── Sessions ─────────────────────────────────────────────────────────
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) throw new Error('SESSION_SECRET must be set in .env');

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error('MONGODB_URI must be set in .env');

app.use(
    session({
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: mongoUri,
            collectionName: 'sessions',
            ttl: 7 * 24 * 60 * 60,  // 7 days
            autoRemove: 'native',
        }),
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,                                      // XSS protection
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        },
        name: 'shop.sid',                                      // Don't expose default session name
    })
);

// ─── Passport ─────────────────────────────────────────────────────────
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// ─── Health ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({status: 'ok', service: 'api'}));

// ─── Apollo ───────────────────────────────────────────────────────────
async function startApollo() {
    const server = new ApolloServer({
        typeDefs,
        resolvers,
        plugins: [ApolloServerPluginDrainHttpServer({httpServer})],
        formatError: (formattedError) => {
            // Don't expose internal errors in production
            if (process.env.NODE_ENV === 'production' && formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
                return {message: 'An internal error occurred', extensions: {code: 'INTERNAL_SERVER_ERROR'}};
            }
            return formattedError;
        },
    });

    await server.start();

    app.use(
        '/graphql',
        // @ts-ignore
        expressMiddleware(server, {
            context: async ({req}) => ({
                user: req.user as {
                    id: string;
                    email: string;
                    role: 'customer' | 'admin';
                    firstName: string;
                    lastName: string
                } | undefined,
                req,
            }),
        })
    );

    const PORT = process.env.PORT || 4000;
    await new Promise<void>((resolve) => httpServer.listen({port: PORT}, resolve));
    console.log(`[api] GraphQL server ready at http://localhost:${PORT}/graphql`);
}

startApollo().catch(console.error);
