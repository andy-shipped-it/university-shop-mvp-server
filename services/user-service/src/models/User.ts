import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'customer' | 'admin';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  gdprConsent: boolean;
  gdprConsentDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const AddressSchema = new Schema({
  street: { type: String },
  city: { type: String },
  postalCode: { type: String },
  country: { type: String },
}, { _id: false });

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['customer', 'admin'],
      default: 'customer',
    },
    isActive: { type: Boolean, default: true },
    address: AddressSchema,
    gdprConsent: { type: Boolean, default: false },
    gdprConsentDate: { type: Date },
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Never expose password in JSON output
UserSchema.set('toJSON', {
    transform: (_doc, ret) => {
        const obj = ret as unknown as Record<string, unknown>;
        obj.id = obj._id?.toString();
        delete obj._id;
        delete obj.__v;
        obj.password = undefined;
        return obj;
    },
});

export const User = mongoose.model<IUser>('User', UserSchema);
