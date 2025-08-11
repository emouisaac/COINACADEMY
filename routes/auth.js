const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const User = require('../models/User');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  const { username, email, password, referral } = req.body;
  if (!username || !email || !password) return res.status(400).json({ message: 'Missing fields' });
  const userExists = await User.findOne({ $or: [{ email }, { username }] });
  if (userExists) return res.status(400).json({ message: 'User exists' });
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, email, password: hashedPassword, referral });
  await user.save();
  res.status(201).json({ message: 'Registered successfully' });
});

// Login
router.post('/login', async (req, res) => {
  const { loginId, password } = req.body;
  const user = await User.findOne({ $or: [{ email: loginId }, { username: loginId }] });
  if (!user || !user.password) return res.status(400).json({ message: 'Invalid credentials' });
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET || 'jwtsecret', { expiresIn: '1d' });
  res.json({ token, user: { username: user.username, email: user.email } });
});

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication, redirect or respond as needed
    // For SPA, you might want to send a token or redirect to a frontend route
    res.redirect('/');
  }
);

module.exports = router;





// NOWPayments endpoint
router.post('/create-checkout', async (req, res) => {
  try {
    const { price_amount, order_id, order_description, success_url } = req.body;
    
    if (!price_amount || !order_id || !order_description) {
      return res.status(400).json({ error: 'Missing required payment details' });
    }

    const domain = process.env.DOMAIN_URL || `http://localhost:${process.env.PORT || 3000}`;
    const redirectPath = success_url ? success_url.replace(/^\//, '') : 'course-unlocked';
    const fullSuccessUrl = `${domain}/${redirectPath}`;

    const response = await axios.post(
      'https://api.nowpayments.io/v1/invoice',
      {
        price_amount: parseFloat(price_amount),
        price_currency: 'usd',
        order_id,
        order_description,
        ipn_callback_url: `${domain}/api/payments/webhook`,
        success_url: fullSuccessUrl,
        cancel_url: `${domain}`
      },
      {
        headers: {
          'x-api-key': process.env.NOWPAYMENTS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({ 
      hosted_url: response.data.invoice_url,
      order_id: response.data.order_id
    });
  } catch (err) {
    console.error('Payment error:', err.response?.data || err.message);
    res.status(500).json({ 
      error: 'Failed to create checkout',
      details: process.env.NODE_ENV === 'development' ? (err.response?.data || err.message) : undefined
    });
  }
});

// Webhook endpoint
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = JSON.parse(req.body.toString());
    console.log('Webhook received:', event);

    if (event.payment_status === 'finished') {
      console.log(`Payment confirmed for order ${event.order_id}`);
      // TODO: Update database, grant access, etc.
    }

    res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send('Invalid webhook data');
  }
});

module.exports = router;
