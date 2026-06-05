import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { userClient } from './serviceClients';

export function configurePassport() {
  passport.use(
    new LocalStrategy(
      { usernameField: 'email', passwordField: 'password' },
      async (email, password, done) => {
        try {
          const response = await userClient.post('/users/authenticate', { email, password });
          const user = response.data;
          return done(null, user);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Authentication failed';
          return done(null, false, { message: msg });
        }
      }
    )
  );

  // Serialize: store only user ID in session
    passport.serializeUser((user: Express.User, done) => {
        console.log('[passport] serializeUser user:', JSON.stringify(user));
        const u = user as { id?: string; _id?: string };
        const id = u.id ?? u._id;
        if (!id) return done(new Error('No user id found during serialization'));
        done(null, id);
    });

  // Deserialize: fetch user from user-service by ID
    passport.deserializeUser(async (id: string, done) => {
        try {
            const response = await userClient.get(`/users/${id}`);
            done(null, response.data);
        } catch (err) {
            done(err, null);
        }
    });
}
