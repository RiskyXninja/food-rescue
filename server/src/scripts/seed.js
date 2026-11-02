import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';

await mongoose.connect(process.env.MONGO_URI);
if (!(await User.findOne({ email: 'admin@foodrescue.dev' }))) {
  await User.create({ name: 'Admin', email: 'admin@foodrescue.dev', password: 'Admin@123', role: 'admin' });
  console.log('Admin created: admin@foodrescue.dev / Admin@123');
} else console.log('Admin already exists');
await mongoose.disconnect();
