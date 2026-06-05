import { gql } from 'graphql-tag';

export const typeDefs = gql`
  scalar Date

  # ─── User ──────────────────────────────────────────────────────────────
  enum UserRole {
    customer
    admin
  }

  type Address {
    street: String
    city: String
    postalCode: String
    country: String
  }

  input AddressInput {
    street: String!
    city: String!
    postalCode: String!
    country: String!
  }

  type User {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    role: UserRole!
    isActive: Boolean!
    address: Address
    gdprConsent: Boolean!
    createdAt: Date!
    updatedAt: Date!
  }

  type AuthPayload {
    user: User!
    message: String!
  }

  # ─── Category ──────────────────────────────────────────────────────────
  type Category {
    id: ID!
    name: String!
    slug: String!
    description: String
    imageUrl: String
    parentId: ID
    isActive: Boolean!
    productCount: Int
  }

  input CreateCategoryInput {
    name: String!
    slug: String!
    description: String
    imageUrl: String
    parentId: ID
  }

  input UpdateCategoryInput {
    name: String
    slug: String
    description: String
    imageUrl: String
    isActive: Boolean
  }

  # ─── Product ───────────────────────────────────────────────────────────
  type Product {
    id: ID!
    name: String!
    slug: String!
    description: String!
    price: Float!
    compareAtPrice: Float
    category: Category
    categoryId: ID!
    images: [String!]!
    stock: Int!
    sku: String
    isActive: Boolean!
    tags: [String!]!
    weight: Float
    createdAt: Date!
    updatedAt: Date!
  }

  type ProductsResult {
    products: [Product!]!
    total: Int!
    page: Int!
    pages: Int!
  }

  input CreateProductInput {
    name: String!
    slug: String!
    description: String!
    price: Float!
    compareAtPrice: Float
    categoryId: ID!
    images: [String!]
    stock: Int
    sku: String
    tags: [String!]
    weight: Float
  }

  input UpdateProductInput {
    name: String
    slug: String
    description: String
    price: Float
    compareAtPrice: Float
    categoryId: ID
    images: [String!]
    stock: Int
    sku: String
    isActive: Boolean
    tags: [String!]
    weight: Float
  }

  input ProductFilterInput {
    categoryId: ID
    search: String
    minPrice: Float
    maxPrice: Float
    page: Int
    limit: Int
  }

  # ─── Order ─────────────────────────────────────────────────────────────
  enum OrderStatus {
    pending
    confirmed
    processing
    shipped
    delivered
    cancelled
    refunded
  }

  enum PaymentStatus {
    pending
    paid
    failed
    refunded
  }

  type OrderItem {
    productId: ID!
    productName: String!
    productSlug: String!
    quantity: Int!
    unitPrice: Float!
    totalPrice: Float!
  }

  type Payment {
    provider: String!
    transactionId: String
    status: PaymentStatus!
    amount: Float!
    currency: String!
    processedAt: Date
  }

  type ShippingAddress {
    firstName: String!
    lastName: String!
    street: String!
    city: String!
    postalCode: String!
    country: String!
  }

  type Order {
    id: ID!
    orderNumber: String!
    userId: ID!
    items: [OrderItem!]!
    subtotal: Float!
    tax: Float!
    shipping: Float!
    total: Float!
    status: OrderStatus!
    payment: Payment!
    shippingAddress: ShippingAddress!
    notes: String
    createdAt: Date!
    updatedAt: Date!
  }

  type OrdersResult {
    orders: [Order!]!
    total: Int!
    page: Int!
    pages: Int!
  }

  input OrderItemInput {
    productId: ID!
    productName: String!
    productSlug: String!
    quantity: Int!
    unitPrice: Float!
    totalPrice: Float!
  }

  input ShippingAddressInput {
    firstName: String!
    lastName: String!
    street: String!
    city: String!
    postalCode: String!
    country: String!
  }

  input CreateOrderInput {
    items: [OrderItemInput!]!
    subtotal: Float!
    tax: Float!
    shipping: Float!
    total: Float!
    shippingAddress: ShippingAddressInput!
    paymentProvider: String!
    notes: String
  }

  # ─── Query & Mutation ─────────────────────────────────────────────────
  type Query {
    # Auth
    me: User

    # Users (admin)
    users(page: Int, limit: Int): [User!]!
    user(id: ID!): User

    # Categories
    categories: [Category!]!
    category(id: ID!): Category
    categoryBySlug(slug: String!): Category

    # Products
    products(filter: ProductFilterInput): ProductsResult!
    product(id: ID!): Product
    productBySlug(slug: String!): Product

    # Orders
    myOrders(page: Int, limit: Int): OrdersResult!
    order(id: ID!): Order
    allOrders(userId: ID, status: OrderStatus, page: Int, limit: Int): OrdersResult!  # admin
  }

  type Mutation {
    # Auth
    register(
      email: String!
      password: String!
      firstName: String!
      lastName: String!
      gdprConsent: Boolean!
    ): AuthPayload!

    login(email: String!, password: String!): AuthPayload!
    logout: Boolean!

    updateProfile(firstName: String, lastName: String, address: AddressInput): User!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!
    deleteAccount: Boolean!  # GDPR right to erasure

    # Categories (admin)
    createCategory(input: CreateCategoryInput!): Category!
    updateCategory(id: ID!, input: UpdateCategoryInput!): Category!
    deleteCategory(id: ID!): Boolean!

    # Products (admin)
    createProduct(input: CreateProductInput!): Product!
    updateProduct(id: ID!, input: UpdateProductInput!): Product!
    deleteProduct(id: ID!): Boolean!

    # Orders
    createOrder(input: CreateOrderInput!): Order!
    updateOrderStatus(id: ID!, status: OrderStatus!): Order!   # admin
    processPayment(orderId: ID!, transactionId: String!, provider: String!, status: PaymentStatus!): Order!
    cancelOrder(id: ID!): Order!
  }
`;
