import mongoose from 'mongoose';

export const STATUSES = [
  'pending', 'approved', 'rejected', 'claimed', 'picked_up', 'delivered', 'cancelled',
];

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const listingSchema = new mongoose.Schema(
  {
    donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    volunteer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    title: { type: String, required: true, trim: true },
    description: String,
    category: { type: String, enum: ['cooked', 'raw', 'packaged', 'bakery', 'other'], default: 'other' },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, default: 'servings' },
    pickupAddress: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: STATUSES, default: 'pending', index: true },
    history: [historySchema],
  },
  { timestamps: true }
);

export default mongoose.model('FoodListing', listingSchema);
