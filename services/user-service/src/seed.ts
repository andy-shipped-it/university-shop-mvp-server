import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from './models/User';

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in .env');

  await mongoose.connect(uri);
  console.log('[seed] MongoDB connected');

  // Seed admin user
  const adminEmail = 'admin@shop.local';
  const existing = await User.findOne({ email: adminEmail });

  if (existing) {
    console.log('[seed] Admin user already exists, skipping.');
  } else {
    const admin = await User.create({
      email: adminEmail,
      password: 'Admin@1234!',
      firstName: 'Shop',
      lastName: 'Admin',
      role: 'admin',
      isActive: true,
      gdprConsent: true,
      gdprConsentDate: new Date(),
    });
    console.log(`[seed] Admin user created: ${admin.email}`);
    console.log('[seed] Login credentials:');
    console.log('  Email:    admin@shop.local');
    console.log('  Password: Admin@1234!');
    console.log('[seed] ⚠️  Change the admin password after first login!');
  }

  // Seed a sample customer
  const customerEmail = 'customer@shop.local';
  const existingCustomer = await User.findOne({ email: customerEmail });
  if (!existingCustomer) {
    await User.create({
      email: customerEmail,
      password: 'Customer@1234!',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'customer',
      isActive: true,
      gdprConsent: true,
      gdprConsentDate: new Date(),
      address: {
        street: '123 Main Street',
        city: 'Berlin',
        postalCode: '10115',
        country: 'Germany',
      },
    });
    console.log('[seed] Sample customer created: customer@shop.local / Customer@1234!');
  }

  await mongoose.disconnect();
  console.log('[seed] Done!');
}

seed().catch((err) => {
  console.error('[seed] Error:', err);
  process.exit(1);
});
