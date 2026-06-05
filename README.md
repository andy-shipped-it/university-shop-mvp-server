# 🛒 Shop System — Server

A microservice-based backend for the IU Shop System, built with **Node.js**, **TypeScript**, **GraphQL (Apollo)**, **MongoDB**, **Kafka**, and **RabbitMQ**.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT (Next.js)                  │
└───────────────────────┬─────────────────────────────┘
                        │ GraphQL (HTTP + Sessions)
┌───────────────────────▼─────────────────────────────┐
│              API Service  :4000                      │
│  Apollo Server + Express + Passport.js Sessions      │
└──────┬──────────────┬──────────────────┬────────────┘
       │ HTTP          │ HTTP             │ HTTP
┌──────▼──────┐  ┌─────▼──────┐  ┌──────▼──────┐
│ User Service│  │Product Svc │  │ Order Svc   │
│   :4001     │  │   :4002    │  │   :4003     │
│  MongoDB    │  │  MongoDB   │  │  MongoDB    │
└──────┬──────┘  └─────┬──────┘  └──────┬──────┘
       │               │                │
       └───────────────┴───────┬────────┘
                               │
             ┌─────────────────▼───────────────────┐
             │           Apache Kafka               │
             │  (event streaming between services)  │
             └─────────────────────────────────────┘
             ┌─────────────────────────────────────┐
             │           RabbitMQ                   │
             │  (task queues: emails, webhooks)     │
             └─────────────────────────────────────┘
```

### Services

| Service | Port | Responsibility |
|---------|------|----------------|
| `api` | 4000 | GraphQL gateway, session auth, request routing |
| `user-service` | 4001 | User CRUD, authentication, GDPR anonymization |
| `product-service` | 4002 | Products, categories, stock management |
| `order-service` | 4003 | Orders, payments, status tracking |
| `shared` | — | Kafka/RabbitMQ clients, shared event types |

### Messaging

- **Kafka** — Event streaming for domain events (user.created, order.created, product.updated, payment.processed)
- **RabbitMQ** — Task queues for transactional work (email notifications, order confirmations, webhooks)

---

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB Atlas account (cloud hosted — just add your connection string)
- Apache Kafka (locally via Docker recommended)
- RabbitMQ (locally via Docker recommended)

### Start Kafka + RabbitMQ with Docker

Use the included helper script from the project root — it auto-detects your Docker setup:

```bash
# From shop-project/
chmod +x start-infra.sh
./start-infra.sh          # start everything
./start-infra.sh down     # stop everything
./start-infra.sh logs     # tail logs
```

Or run directly with the modern Docker CLI:

```bash
# From shop-project/ (modern Docker Desktop / CLI plugin — no hyphen)
docker compose up -d

# Older standalone installs only
docker-compose up -d
```

Services started:
- **Kafka** on `localhost:9092`
- **Kafka UI** on `http://localhost:8080`
- **RabbitMQ** on `localhost:5672`
- **RabbitMQ Management UI** on `http://localhost:15672` (guest / guest)

---

## Installation

```bash
# Clone the repo and navigate to the server directory
cd server

# Install all dependencies (root + all workspaces)
npm install
```

---

## Configuration

Each service has its own `.env` file. Copy the examples and fill in your values:

```bash
cp services/api/.env.example services/api/.env
cp services/user-service/.env.example services/user-service/.env
cp services/product-service/.env.example services/product-service/.env
cp services/order-service/.env.example services/order-service/.env
```

### Required Environment Variables

**`services/api/.env`**
```env
PORT=4000
SESSION_SECRET=your-long-random-secret-here
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/shop-sessions
USER_SERVICE_URL=http://localhost:4001
PRODUCT_SERVICE_URL=http://localhost:4002
ORDER_SERVICE_URL=http://localhost:4003
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

**`services/user-service/.env`**
```env
PORT=4001
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/shop-users
KAFKA_BROKERS=localhost:9092
RABBITMQ_URL=amqp://localhost:5672
```

**`services/product-service/.env`**
```env
PORT=4002
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/shop-products
KAFKA_BROKERS=localhost:9092
RABBITMQ_URL=amqp://localhost:5672
```

**`services/order-service/.env`**
```env
PORT=4003
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/shop-orders
KAFKA_BROKERS=localhost:9092
RABBITMQ_URL=amqp://localhost:5672
```

---

## Seeding the Database

```bash
npm run seed
```

This creates:
- **Admin user**: `admin@shop.local` / `Admin@1234!`
- **Sample customer**: `customer@shop.local` / `Customer@1234!`

> ⚠️ Change the admin password immediately after first login!

---

## Running

### Development (all services concurrently)
```bash
npm run dev
```

### Run individual services
```bash
npm run dev -w services/api
npm run dev -w services/user-service
npm run dev -w services/product-service
npm run dev -w services/order-service
```

---

## GraphQL Codegen

Generate TypeScript types from the GraphQL schema:

```bash
npm run codegen
# or
npm run codegen -w services/api
```

---

## API Endpoints

- **GraphQL Playground**: http://localhost:4000/graphql
- **Health checks**:
  - http://localhost:4000/health
  - http://localhost:4001/health
  - http://localhost:4002/health
  - http://localhost:4003/health

---

## Security Features

- 🔒 **Passport.js** session-based authentication
- 🔑 **bcrypt** (12 rounds) password hashing
- 🍪 **HttpOnly, SameSite** session cookies (XSS protection)
- 🛡️ **Helmet.js** for HTTP security headers
- ⏱️ **Rate limiting** (100 req/15min general, 10 req/15min for auth)
- 🗄️ **MongoDB session store** via connect-mongo
- 🚫 **Input validation** on all service endpoints
- 🔐 **Role-based access control** (customer / admin)

## GDPR Compliance

- User deletion anonymizes data (right to erasure) instead of hard deleting
- GDPR consent tracked at registration with timestamp
- All personal data deletable on request
- Synthetic/anonymized test data only
