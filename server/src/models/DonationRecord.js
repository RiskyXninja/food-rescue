import mongoose from 'mongoose';

// Created when a listing is delivered (for reports / impact stats)
const recordSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodListing', required: true, unique: true },
    donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    volunteer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quantity: Number,
    unit: String,
    deliveredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('DonationRecord', recordSchema);
