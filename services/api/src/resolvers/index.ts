import {GraphQLError} from 'graphql';
import {userClient, productClient, orderClient} from '../middleware/serviceClients';
import {requireAuth, requireAdmin, AuthContext} from '../middleware/auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = Record<string, any>;
type Context = AuthContext & {
    req: Express.Request & {
        login: (user: unknown, cb: (err: unknown) => void) => void;
        logout: (cb: (err: unknown) => void) => void
    }
};

export const resolvers = {
    Query: {
        me: (_: unknown, __: Args, context: Context) => {
            return context.user || null;
        },

        users: async (_: unknown, args: Args, context: Context) => {
            requireAdmin(context);
            const res = await userClient.get('/users', {params: args});
            return res.data.users;
        },

        user: async (_: unknown, {id}: Args, context: Context) => {
            requireAdmin(context);
            const res = await userClient.get(`/users/${id}`);
            return res.data;
        },

        products: async (_: unknown, {filter = {}}: Args) => {
            const res = await productClient.get('/products', {params: filter});
            return res.data;
        },

        product: async (_: unknown, {id}: Args) => {
            const res = await productClient.get(`/products/${id}`);
            return res.data;
        },

        categories: async () => {
            const res = await productClient.get('/categories');
            return res.data;
        },

        category: async (_: unknown, {id}: Args) => {
            const res = await productClient.get(`/categories/${id}`);
            return res.data;
        },

        categoryBySlug: async (_: unknown, {slug}: Args) => {
            const res = await productClient.get(`/categories/slug/${slug}`);
            return res.data;
        },

        productBySlug: async (_: unknown, {slug}: Args) => {
            const res = await productClient.get(`/products/slug/${slug}`);
            return res.data;
        },

        myOrders: async (_: unknown, args: Args, context: Context) => {
            const user = requireAuth(context);
            const res = await orderClient.get('/orders', {params: {userId: user.id, ...args}});
            return res.data;
        },

        order: async (_: unknown, {id}: Args, context: Context) => {
            const user = requireAuth(context);
            const res = await orderClient.get(`/orders/${id}`);
            const order = res.data;
            // Non-admin can only see their own orders
            if (user.role !== 'admin' && order.userId !== user.id) {
                throw new GraphQLError('Access denied', {extensions: {code: 'FORBIDDEN'}});
            }
            return order;
        },

        allOrders: async (_: unknown, args: Args, context: Context) => {
            requireAdmin(context);
            const res = await orderClient.get('/orders', {params: args});
            return res.data;
        },
    },

    Mutation: {
        register: async (_: unknown, args: Args, context: Context) => {
            const res = await userClient.post('/users/register', args);
            const user = res.data;
            // Auto-login after register
            await new Promise<void>((resolve, reject) => {
                context.req.login(user, (err: unknown) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            return {user, message: 'Registration successful!'};
        },

        login: async (_: unknown, {email, password}: Args, context: Context) => {
            const res = await userClient.post('/users/authenticate', {email, password});
            const user = res.data;
            if (!user) {
                throw new GraphQLError('Invalid credentials', {extensions: {code: 'UNAUTHENTICATED'}});
            }
            await new Promise<void>((resolve, reject) => {
                context.req.login(user, (err: unknown) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            return {user, message: 'Login successful!'};
        },

        logout: async (_: unknown, __: Args, context: Context) => {
            await new Promise<void>((resolve, reject) => {
                context.req.logout((err: unknown) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            return true;
        },

        updateProfile: async (_: unknown, args: Args, context: Context) => {
            const user = requireAuth(context);
            const res = await userClient.put(`/users/${user.id}`, args);
            return res.data;
        },

        changePassword: async (_: unknown, {currentPassword, newPassword}: Args, context: Context) => {
            const user = requireAuth(context);
            // Verify current password first
            await userClient.post('/users/authenticate', {email: user.email, password: currentPassword});
            await userClient.put(`/users/${user.id}`, {password: newPassword});
            return true;
        },

        deleteAccount: async (_: unknown, __: Args, context: Context) => {
            const user = requireAuth(context);
            await userClient.delete(`/users/${user.id}`);
            await new Promise<void>((resolve, reject) => {
                context.req.logout((err: unknown) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            return true;
        },

        createCategory: async (_: unknown, {input}: Args, context: Context) => {
            requireAdmin(context);
            const res = await productClient.post('/categories', input);
            return res.data;
        },

        updateCategory: async (_: unknown, {id, input}: Args, context: Context) => {
            requireAdmin(context);
            const res = await productClient.put(`/categories/${id}`, input);
            return res.data;
        },

        deleteCategory: async (_: unknown, {id}: Args, context: Context) => {
            requireAdmin(context);
            await productClient.delete(`/categories/${id}`);
            return true;
        },

        createProduct: async (_: unknown, {input}: Args, context: Context) => {
            requireAdmin(context);
            const res = await productClient.post('/products', input);
            return res.data;
        },

        updateProduct: async (_: unknown, {id, input}: Args, context: Context) => {
            requireAdmin(context);
            const res = await productClient.put(`/products/${id}`, input);
            return res.data;
        },

        deleteProduct: async (_: unknown, {id}: Args, context: Context) => {
            requireAdmin(context);
            await productClient.delete(`/products/${id}`);
            return true;
        },

        createOrder: async (_: unknown, {input}: Args, context: Context) => {
            const user = requireAuth(context);
            const res = await orderClient.post('/orders', {
                ...input,
                userId: user.id,
                payment: {provider: input.paymentProvider, status: 'pending', amount: input.total, currency: 'EUR'},
            });
            return res.data;
        },

        updateOrderStatus: async (_: unknown, {id, status}: Args, context: Context) => {
            requireAdmin(context);
            const res = await orderClient.patch(`/orders/${id}/status`, {status});
            return res.data;
        },

        processPayment: async (_: unknown, {orderId, transactionId, provider, status}: Args, context: Context) => {
            requireAuth(context);
            const res = await orderClient.patch(`/orders/${orderId}/payment`, {transactionId, provider, status});
            return res.data;
        },

        cancelOrder: async (_: unknown, {id}: Args, context: Context) => {
            const user = requireAuth(context);
            const orderRes = await orderClient.get(`/orders/${id}`);
            const order = orderRes.data;
            if (user.role !== 'admin' && order.userId !== user.id) {
                throw new GraphQLError('Access denied', {extensions: {code: 'FORBIDDEN'}});
            }
            const res = await orderClient.patch(`/orders/${id}/status`, {status: 'cancelled'});
            return res.data;
        },
    },

    // Field resolvers
    Product: {
        category: async (parent: { categoryId: string }) => {
            try {
                const res = await productClient.get(`/categories/${parent.categoryId}`);
                return res.data;
            } catch {
                return null;
            }
        },
    },
};
