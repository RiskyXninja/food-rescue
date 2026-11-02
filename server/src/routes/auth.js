
import { Router } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import User from '../models/User.js';
import { protect, authorize, signToken } from '../middleware/auth.js';

const router = Router();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
});

const GENERIC_OTP_MESSAGE =
  'If an account exists with that email, an OTP has been sent.';

const hashValue = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

const clearResetData = (user) => {
  user.resetOtpHash = undefined;
  user.resetOtpExpiresAt = undefined;
  user.resetOtpAttempts = 0;
  user.resetOtpLastSentAt = undefined;
  user.resetTokenHash = undefined;
  user.resetTokenExpiresAt = undefined;
};

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role, phone, address } = req.body;

    const safeRole = ['donor', 'volunteer'].includes(role)
      ? role
      : 'donor';

    const normalizedEmail = email?.trim().toLowerCase();

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({
        message: 'Email already in use',
      });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role: safeRole,
      phone,
      address,
    });

    res.status(201).json({
      token: signToken(user._id, user.tokenVersion),
      user: publicUser(user),
    });
  } catch (e) {
    next(e);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        message: 'Invalid credentials',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: 'Your account is inactive',
      });
    }

    res.json({
      token: signToken(user._id, user.tokenVersion),
      user: publicUser(user),
    });
  } catch (e) {
    next(e);
  }
});

// Current logged-in user
router.get('/me', protect, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Request password-reset OTP
router.post('/forgot-password/request-otp', async (req, res, next) => {
  try {
    const normalizedEmail = req.body.email?.trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({
        message: 'Please enter your email address',
      });
    }

    const user = await User.findOne({
      email: normalizedEmail,
      isActive: true,
    }).select('+resetOtpLastSentAt');

    // Do not reveal whether an account exists.
    if (!user) {
      return res.json({ message: GENERIC_OTP_MESSAGE });
    }

    // Allow only one OTP request per account every 60 seconds.
    const now = Date.now();
    const lastSent = user.resetOtpLastSentAt
      ? new Date(user.resetOtpLastSentAt).getTime()
      : 0;

    if (now - lastSent < 60 * 1000) {
      return res.json({ message: GENERIC_OTP_MESSAGE });
    }

    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
      console.error('Resend environment variables are missing.');
      return res.status(503).json({
        message: 'Email service is temporarily unavailable. Please try again later.',
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();

    user.resetOtpHash = hashValue(otp);
    user.resetOtpExpiresAt = new Date(now + 5 * 60 * 1000);
    user.resetOtpAttempts = 0;
    user.resetOtpLastSentAt = new Date(now);
    user.resetTokenHash = undefined;
    user.resetTokenExpiresAt = undefined;

    await user.save();

     try {
      await transporter.sendMail({
        from: `"Food Rescue" <${process.env.GMAIL_USER}>`,
        to: user.email,
        subject: 'Your Food Rescue password reset code',
        text: `Your password reset OTP is ${otp}. It expires in 5 minutes. If you did not request this, you can ignore this email.`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
            <h2>Reset your Food Rescue password</h2>
            <p>Use the following verification code to reset your password:</p>
            <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px 0">
              ${otp}
            </div>
            <p>This code expires in <strong>5 minutes</strong>.</p>
            <p>If you did not request a password reset, you can ignore this email.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error('Gmail email error:', error.message);

      clearResetData(user);
      await user.save();

      return res.status(503).json({
        message: 'Unable to send the email right now. Please try again later.',
      });
    }

    return res.json({ message: GENERIC_OTP_MESSAGE });
  } catch (e) {
    next(e);
  }
});

// Verify OTP and issue a temporary reset token
router.post('/forgot-password/verify-otp', async (req, res, next) => {
  try {
    const normalizedEmail = req.body.email?.trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();

    if (!normalizedEmail || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: 'Please enter a valid email and 6-digit OTP',
      });
    }

    const user = await User.findOne({
      email: normalizedEmail,
      isActive: true,
    }).select(
      '+resetOtpHash +resetOtpExpiresAt +resetOtpAttempts'
    );

    if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt) {
      return res.status(400).json({
        message: 'Invalid or expired OTP. Please request a new one.',
      });
    }

    if (user.resetOtpExpiresAt.getTime() < Date.now()) {
      clearResetData(user);
      await user.save();

      return res.status(400).json({
        message: 'OTP has expired. Please request a new one.',
      });
    }

    if (user.resetOtpAttempts >= 5) {
      clearResetData(user);
      await user.save();

      return res.status(429).json({
        message: 'Too many incorrect attempts. Please request a new OTP.',
      });
    }

    if (hashValue(otp) !== user.resetOtpHash) {
      user.resetOtpAttempts += 1;

      if (user.resetOtpAttempts >= 5) {
        clearResetData(user);
      }

      await user.save();

      return res.status(400).json({
        message: 'Incorrect OTP. Please try again.',
      });
    }

    // OTP is valid. Create a random, short-lived reset token.
    const resetToken = crypto.randomBytes(32).toString('hex');

    user.resetTokenHash = hashValue(resetToken);
    user.resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // OTP cannot be reused after successful verification.
    user.resetOtpHash = undefined;
    user.resetOtpExpiresAt = undefined;
    user.resetOtpAttempts = 0;

    await user.save();

    return res.json({
      message: 'OTP verified successfully',
      resetToken,
    });
  } catch (e) {
    next(e);
  }
});

// Set a new password using the temporary reset token
router.post('/forgot-password/reset-password', async (req, res, next) => {
  try {
    const normalizedEmail = req.body.email?.trim().toLowerCase();
    const { resetToken, newPassword } = req.body;

    if (!normalizedEmail || !resetToken || !newPassword) {
      return res.status(400).json({
        message: 'Email, reset token and new password are required',
      });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long',
      });
    }

    const user = await User.findOne({
      email: normalizedEmail,
      isActive: true,
    }).select('+resetTokenHash +resetTokenExpiresAt');

    if (
      !user ||
      !user.resetTokenHash ||
      !user.resetTokenExpiresAt ||
      user.resetTokenExpiresAt.getTime() < Date.now() ||
      hashValue(resetToken) !== user.resetTokenHash
    ) {
      return res.status(400).json({
        message: 'Invalid or expired reset session. Please start again.',
      });
    }

    user.password = newPassword;

    // Invalidate all previously issued JWT sessions.
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    clearResetData(user);

    // Existing User model hook hashes the new password.
    await user.save();

    return res.json({
      message: 'Password reset successfully. Please log in with your new password.',
    });
  } catch (e) {
    next(e);
  }
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
        user.tokenVersion = (user.tokenVersion || 0) + 1;
      }

      await user.save();

      res.json({
        message: 'Admin credentials updated successfully',
        token: signToken(user._id, user.tokenVersion),
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
