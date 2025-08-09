import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String },
  affiliateCode: { type: String, unique: true },
  referredBy: { type: String }, // affiliateCode of referrer
  commission: { type: Number, default: 0 },
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
