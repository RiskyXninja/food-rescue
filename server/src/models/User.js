
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['donor', 'volunteer', 'admin'],
      default: 'donor',
    },
    phone: String,
    address: String,
    isActive: { type: Boolean, default: true },

    // Invalidates previously issued JWT sessions after password reset.
    tokenVersion: { type: Number, default: 0 },

    // Password reset OTP fields.
    resetOtpHash: { type: String, select: false },
    resetOtpExpiresAt: { type: Date, select: false },
    resetOtpAttempts: { type: Number, default: 0, select: false },
    resetOtpLastSentAt: { type: Date, select: false },

    // Temporary password-reset authorization token.
    resetTokenHash: { type: String, select: false },
    resetTokenExpiresAt: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model('User', userSchema);
