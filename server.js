
// Load environment variables from .env file
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/User');

const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// Enable CORS for all routes (allow all origins)
app.use(cors());

// Express session (required for passport)
app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  let user = await User.findOne({ googleId: profile.id });
  if (!user) {
    user = await User.create({
      googleId: profile.id,
      username: profile.displayName,
      email: profile.emails[0].value
    });
  }
  return done(null, user);
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});
});

// Serve static frontend files (HTML, CSS, JS) from project root
app.use(express.static(__dirname));

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Parse JSON bodies for API
app.use(express.json());

// Parse raw body for webhook verification
app.use('/webhook', bodyParser.raw({ type: 'application/json' }));

// Endpoint to create a NOWPayments invoice
app.post('/api/create-checkout', async (req, res) => {
  try {
    // Accept price_amount, order_id, order_description, and success_url from frontend
    const { price_amount, order_id, order_description, success_url } = req.body || {};
    if (!price_amount || !order_id || !order_description) {
      return res.status(400).json({ error: 'Missing required payment details.' });
    }
    const domain = process.env.DOMAIN_URL || ('http://localhost:' + PORT);
    const redirectPath = success_url ? success_url.replace(/^\//, '') : 'course-unlocked.html';
    const fullSuccessUrl = `${domain}/${redirectPath}`;
    const response = await axios.post(
      'https://api.nowpayments.io/v1/invoice',
      {
        price_amount,
        price_currency: 'usd',
        order_id,
        order_description,
        success_url: fullSuccessUrl,
        cancel_url: `${domain}/index.html`
      },
      {
        headers: {
          'x-api-key': process.env.NOWPAYMENTS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({ hosted_url: response.data.invoice_url });
  } catch (err) {
    console.error('Error creating NOWPayments invoice:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

// Webhook endpoint for NOWPayments payment status
app.post('/webhook', express.json(), (req, res) => {
  const event = req.body;
  // Log all webhook events for debugging
  console.log('NOWPayments webhook event:', event);
  // Check if payment is confirmed
  if (event.payment_status === 'finished') {
    // Grant access to course (e.g., update DB, send email, etc.)
    console.log(`NOWPayments: Payment confirmed for order ${event.order_id} (amount: ${event.price_amount} ${event.price_currency}). Access granted.`);
    // You could trigger an email or database update here
  }
  res.status(200).send('Webhook received');
});

// Security tip: In production, restrict webhook endpoint to Coinbase IPs or use a secret path
// Security tip: Never expose your API keys or webhook secret in frontend code or public repos

// Simple homepage route (optional)
app.get('/api/health', (req, res) => {
  res.send('🚀 Server is running!');
});

// Basic register endpoint
app.post('/api/register', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || !email) {
    return res.status(400).json({ error: 'Username, email, and password required.' });
  }
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res.status(409).json({ error: 'Username already exists.' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashedPassword, email });
  await user.save();
  res.status(201).json({ message: 'Registration successful.' });
});

// Basic login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }
  const user = await User.findOne({ username });
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.status(200).json({ message: 'Login successful.', token });
});

// Google OAuth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', {
  failureRedirect: '/login.html',
  session: true
}), (req, res) => {
  // Successful login, redirect to homepage or dashboard
  res.redirect('/');
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
