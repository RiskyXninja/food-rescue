import { Router } from 'express';
import User from '../models/User.js';
import { protect, signToken } from '../middleware/auth.js';

const router = Router();
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role, phone, address } = req.body;
    // Admins can never self-register
    const safeRole = ['donor', 'volunteer'].includes(role) ? role : 'donor';
    if (await User.findOne({ email })) return res.status(409).json({ message: 'Email already in use' });
    const user = await User.create({ name, email, password, role: safeRole, phone, address });
    res.status(201).json({ token: signToken(user._id), user: publicUser(user) });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ token: signToken(user._id), user: publicUser(user) });
  } catch (e) { next(e); }
});

router.get('/me', protect, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
