
import { Router } from 'express';
import User from '../models/User.js';
import { protect, authorize, signToken } from '../middleware/auth.js';

const router = Router();

const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
});

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role, phone, address } = req.body;

    // Admins can never self-register
    const safeRole = ['donor', 'volunteer'].includes(role) ? role : 'donor';

    if (await User.findOne({ email })) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: safeRole,
      phone,
      address,
    });

    res.status(201).json({
      token: signToken(user._id),
      user: publicUser(user),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({
      token: signToken(user._id),
      user: publicUser(user),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/me', protect, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Secure admin email and password update
router.patch(
  '/admin-credentials',
  protect,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const { currentPassword, email, newPassword } = req.body;

      if (!currentPassword) {
        return res.status(400).json({
          message: 'Current password is required',
        });
      }

      if (email === undefined && newPassword === undefined) {
        return res.status(400).json({
          message: 'Provide a new email or password',
        });
      }

      const user = await User.findById(req.user._id).select('+password');

      if (!user || !(await user.matchPassword(currentPassword))) {
        return res.status(401).json({
          message: 'Current password is incorrect',
        });
      }

      if (email !== undefined) {
        const normalizedEmail = email.trim().toLowerCase();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
          return res.status(400).json({
            message: 'Please enter a valid email address',
          });
        }

        const existingUser = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: user._id },
        });

        if (existingUser) {
          return res.status(409).json({
            message: 'This email is already in use',
          });
        }

        user.email = normalizedEmail;
      }

      if (newPassword !== undefined) {
        if (typeof newPassword !== 'string' || newPassword.length < 8) {
          return res.status(400).json({
            message: 'New password must be at least 8 characters',
          });
        }

        user.password = newPassword;
      }

      // The User model automatically hashes modified passwords.
      await user.save();

      res.json({
        message: 'Admin credentials updated successfully',
        token: signToken(user._id),
        user: publicUser(user),
      });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({
          message: 'This email is already in use',
        });
      }
      next(e);
    }
  }
);

export default router;
