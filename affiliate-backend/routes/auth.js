import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, referredBy } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    // Generate unique affiliate code
    let code;
    do {
      code = Math.random().toString(36).substring(2, 10).toUpperCase();
    } while (await User.findOne({ affiliateCode: code }));
    const user = new User({ email, password: hash, name, affiliateCode: code, referredBy });
    await user.save();
    // Add to referrer's referrals
    if (referredBy) {
      const referrer = await User.findOne({ affiliateCode: referredBy });
      if (referrer) {
        referrer.referrals.push(user._id);
        await referrer.save();
      }
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { email, name, affiliateCode: code, referredBy } });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { email: user.email, name: user.name, affiliateCode: user.affiliateCode, referredBy: user.referredBy } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
