import { Router } from 'express';
import FoodListing from '../models/FoodListing.js';
import DonationRecord from '../models/DonationRecord.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

const populate = [
  { path: 'donor', select: 'name address' },
  { path: 'volunteer', select: 'name phone' },
];

// push a status change, save, and broadcast to all connected clients
async function transition(req, listing, status, note) {
  listing.status = status;
  listing.history.push({ status, by: req.user._id, note });
  await listing.save();
  req.app.get('io').emit('listing:updated', { id: listing._id, status });
  return listing.populate(populate);
}

const bad = (res, msg, code = 400) => res.status(code).json({ message: msg });

function validImageData(value) {
  if (!value) return true;
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || value.length > 1400000) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 1024 * 1024) return false;
  if (match[1] === 'jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (match[1] === 'png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

function listingView(listing, user) {
  const data = listing.toObject ? listing.toObject() : { ...listing };
  const donorOwns = String(data.donor?._id || data.donor) === String(user._id);
  if (!donorOwns && !data.showPhone) delete data.donorPhone;
  return data;
}

// List: scoped by role
router.get('/', async (req, res, next) => {
  try {
    const { role, _id } = req.user;
    const q = {};
    if (role === 'donor') q.donor = _id;
    if (role === 'volunteer') q.$or = [{ status: 'approved' }, { volunteer: _id }];
    if (req.query.status) q.status = req.query.status;
    const rows = await FoodListing.find(q).populate(populate).sort('-createdAt');
    res.json(rows.map((row) => listingView(row, req.user)));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const l = await FoodListing.findById(req.params.id).populate(populate);
    if (!l) return bad(res, 'Not found', 404);
    res.json(listingView(l, req.user));
  } catch (e) { next(e); }
});

// Donor creates -> starts in "pending" (approval pipeline)
router.post('/', authorize('donor'), async (req, res, next) => {
  try {
    const { title, description, category, quantity, unit, pickupAddress, expiresAt,
      donorPhone, showPhone, imageData, location } = req.body;
    const phoneDigits = String(donorPhone || '').replace(/\D/g, '');
    if (donorPhone && (!/^\+?[\d\s().-]{7,24}$/.test(donorPhone) || phoneDigits.length < 7 || phoneDigits.length > 15)) return bad(res, 'Enter a valid phone number');
    if (!validImageData(imageData)) return bad(res, 'Image must be JPEG, PNG, or WebP under 1 MB');
    if (location && (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude) || Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180)) return bad(res, 'Location coordinates are invalid');
    const l = await FoodListing.create({
      title, description, category, quantity, unit, pickupAddress, expiresAt,
      donorPhone: donorPhone?.trim(), showPhone: showPhone === true && Boolean(donorPhone), imageData, location,
      donor: req.user._id,
      history: [{ status: 'pending', by: req.user._id }],
    });
    req.app.get('io').emit('listing:updated', { id: l._id, status: 'pending' });
    res.status(201).json(listingView(l, req.user));
  } catch (e) { next(e); }
});

// Admin approves / rejects
router.patch('/:id/review', authorize('admin'), async (req, res, next) => {
  try {
    const { decision, note } = req.body;
    if (!['approve', 'reject'].includes(decision)) return bad(res, 'decision must be approve|reject');
    const l = await FoodListing.findById(req.params.id);
    if (!l) return bad(res, 'Not found', 404);
    if (l.status !== 'pending') return bad(res, `Cannot review a ${l.status} listing`);
    res.json(await transition(req, l, decision === 'approve' ? 'approved' : 'rejected', note));
  } catch (e) { next(e); }
});

// Volunteer claims (atomic: prevents two volunteers claiming the same listing)
router.patch('/:id/claim', authorize('volunteer'), async (req, res, next) => {
  try {
    const l = await FoodListing.findOneAndUpdate(
      { _id: req.params.id, status: 'approved', expiresAt: { $gt: new Date() } },
      {
        status: 'claimed',
        volunteer: req.user._id,
        $push: { history: { status: 'claimed', by: req.user._id } },
      },
      { new: true }
    ).populate(populate);
    if (!l) return bad(res, 'Listing unavailable (already claimed or expired)', 409);
    req.app.get('io').emit('listing:updated', { id: l._id, status: 'claimed' });
    res.json(l);
  } catch (e) { next(e); }
});

// Assigned volunteer: claimed -> picked_up -> delivered
const NEXT = { claimed: 'picked_up', picked_up: 'delivered' };
router.patch('/:id/status', authorize('volunteer'), async (req, res, next) => {
  try {
    const l = await FoodListing.findById(req.params.id);
    if (!l) return bad(res, 'Not found', 404);
    if (String(l.volunteer) !== String(req.user._id)) return bad(res, 'Not your pickup', 403);
    if (NEXT[l.status] !== req.body.status) return bad(res, `Invalid transition from ${l.status}`);
    const updated = await transition(req, l, req.body.status, req.body.note);
    if (req.body.status === 'delivered') {
      await DonationRecord.create({
        listing: l._id, donor: l.donor, volunteer: l.volunteer,
        quantity: l.quantity, unit: l.unit,
      });
    }
    res.json(updated);
  } catch (e) { next(e); }
});

// Donor cancels while still pending
router.patch('/:id/cancel', authorize('donor'), async (req, res, next) => {
  try {
    const l = await FoodListing.findOne({ _id: req.params.id, donor: req.user._id });
    if (!l) return bad(res, 'Not found', 404);
    if (l.status !== 'pending') return bad(res, 'Only pending listings can be cancelled');
    res.json(await transition(req, l, 'cancelled'));
  } catch (e) { next(e); }
});

export default router;
