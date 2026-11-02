
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const signToken = (id, tokenVersion = 0) =>
  jwt.sign(
    { id, ver: tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// Authentication: who are you?
export const protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        message: 'Invalid or expired token',
      });
    }

    // Older tokens without a version are treated as version 0.
    const tokenVersion = decoded.ver ?? 0;

    if (tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        message: 'Session expired. Please log in again.',
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({
      message: 'Invalid or expired token',
    });
  }
};

// Authorization: are you allowed?
export const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role)
    ? next()
    : res.status(403).json({
        message: `Requires role: ${roles.join(' or ')}`,
      });
