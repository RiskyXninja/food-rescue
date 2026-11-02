import { Router } from 'express';
import User from '../models/User.js';
import FoodListing from '../models/FoodListing.js';
import DonationRecord from '../models/DonationRecord.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect, authorize('admin'));

router.get('/users', async (_req, res) => res.json(await User.find().sort('-createdAt')));

router.patch('/users/:id/active', async (req, res) => {
  const u = await User.findByIdAndUpdate(req.params.id, { isActive: !!req.body.isActive }, { new: true });
  res.json(u);
});

router.get('/stats', async (_req, res) => {
  const [byStatus, delivered] = await Promise.all([
    FoodListing.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    DonationRecord.aggregate([{ $group: { _id: null, total: { $sum: '$quantity' }, count: { $sum: 1 } } }]),
  ]);
  res.json({ byStatus, delivered: delivered[0] || { total: 0, count: 0 } });
});

router.get('/records', async (_req, res) =>
  res.json(await DonationRecord.find().populate('donor volunteer', 'name').populate('listing', 'title').sort('-deliveredAt'))
);

export default router;
