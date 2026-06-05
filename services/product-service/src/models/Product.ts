import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  categoryId: mongoose.Types.ObjectId;
  images: string[];
  stock: number;
  sku?: string;
  isActive: boolean;
  tags: string[];
  weight?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, index: 'text' },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    images: [{ type: String }],
    stock: { type: Number, default: 0, min: 0 },
    sku: { type: String, unique: true, sparse: true },
    isActive: { type: Boolean, default: true },
    tags: [{ type: String, lowercase: true }],
    weight: { type: Number },
  },
  { timestamps: true }
);

ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });

ProductSchema.set('toJSON', {
    transform: (_doc, ret) => {
        const obj = ret as unknown as Record<string, unknown>;
        obj.id = obj._id?.toString();
        delete obj._id;
        delete obj.__v;
        return obj;
    },
});

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
