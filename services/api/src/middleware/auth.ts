import { GraphQLError } from 'graphql';

export interface AuthContext {
  user?: {
    id: string;
    email: string;
    role: 'customer' | 'admin';
    firstName: string;
    lastName: string;
  };
}

export function requireAuth(context: AuthContext) {
  if (!context.user) {
    throw new GraphQLError('Not authenticated. Please log in.', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
}

export function requireAdmin(context: AuthContext) {
  const user = requireAuth(context);
  if (user.role !== 'admin') {
    throw new GraphQLError('Access denied. Admin only.', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return user;
}
