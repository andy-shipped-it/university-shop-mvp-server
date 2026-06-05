import mongoose, { Document, Schema } from 'mongoose';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  productSlug: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface IPayment {
  provider: string;
  transactionId?: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  processedAt?: Date;
}

export interface IShippingAddress {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface IOrder extends Document {
  orderNumber: string;
  userId: string;
  items: IOrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  payment: IPayment;
  shippingAddress: IShippingAddress;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  productId: { type: Schema.Types.ObjectId, required: true },
  productName: { type: String, required: true },
  productSlug: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
}, { _id: false });

const PaymentSchema = new Schema<IPayment>({
  provider: { type: String, required: true },
  transactionId: { type: String },
  status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'EUR' },
  processedAt: { type: Date },
}, { _id: false });

const ShippingAddressSchema = new Schema<IShippingAddress>({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true },
}, { _id: false });

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, unique: true, required: true, index: true },
    userId: { type: String, required: true, index: true },
    items: [OrderItemSchema],
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending',
    },
    payment: PaymentSchema,
    shippingAddress: ShippingAddressSchema,
    notes: { type: String },
  },
  { timestamps: true }
);

// Auto-generate order number before validation
OrderSchema.pre('validate', async function (next) {
  if (!this.orderNumber) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.orderNumber = `ORD-${ts}-${rand}`;
  }
  next();
});

OrderSchema.set('toJSON', {
    transform: (_doc, ret) => {
        const obj = ret as unknown as Record<string, unknown>;
        obj.id = obj._id?.toString();
        delete obj._id;
        delete obj.__v;
        return obj;
    },
});

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
