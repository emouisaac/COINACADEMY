// Request password reset
router.post('/request-password-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const user = await User.findOne({ email });
  if (!user) return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
  const token = require('crypto').randomBytes(32).toString('hex');
  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 1000 * 60 * 60; // 1 hour
  await user.save();
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5500'}/reset-password.html?token=${token}`;
  await sendMail({
    to: email,
    subject: 'Reset your password - CoinAcademia',
    html: `<p>To reset your password, click the link below:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
  });
  res.json({ message: 'If that email is registered, a reset link has been sent.' });
});

// Reset password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Missing token or password' });
  const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
  if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
  user.password = await require('bcryptjs').hash(password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  res.json({ message: 'Password reset successful. You can now log in.' });
});
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { sendMail } from '../utils/email.js';

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
    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const user = new User({ email, password: hash, name, affiliateCode: code, referredBy, emailVerificationToken });
    await user.save();
    // Add to referrer's referrals
    if (referredBy) {
      const referrer = await User.findOne({ affiliateCode: referredBy });
      if (referrer) {
        referrer.referrals.push(user._id);
        await referrer.save();
      }
    }
    // Send verification email
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5500'}/verify-email.html?token=${emailVerificationToken}`;
    await sendMail({
      to: email,
      subject: 'Verify your email - CoinAcademia',
      html: `<p>Welcome to CoinAcademia!</p><p>Please verify your email by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { email, name, affiliateCode: code, referredBy }, message: 'Registration successful. Please check your email to verify your account.' });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});
// Email verification endpoint
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing token' });
  const user = await User.findOne({ emailVerificationToken: token });
  if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  await user.save();
  res.json({ message: 'Email verified successfully.' });
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
