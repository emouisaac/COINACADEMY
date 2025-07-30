import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Get affiliate dashboard data
router.get('/dashboard', auth, async (req, res) => {
  const user = await User.findById(req.user.id).populate('referrals', 'email name affiliateCode');
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    email: user.email,
    name: user.name,
    affiliateCode: user.affiliateCode,
    referredBy: user.referredBy,
    commission: user.commission,
    referrals: user.referrals
  });
});

// Record a commission (to be called after a successful payment)
router.post('/commission', async (req, res) => {
  const { affiliateCode, amount } = req.body;
  const user = await User.findOne({ affiliateCode });
  if (!user) return res.status(404).json({ error: 'Affiliate not found' });
  user.commission += amount;
  await user.save();
  res.json({ success: true });
});

// Withdraw request (for demo, just resets commission)
router.post('/withdraw', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.commission = 0;
  await user.save();
  res.json({ success: true });
});

export default router;
