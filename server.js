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

// Connect to MongoDB with improved error handling
mongoose.connect(process.env.MONGODB_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.JWT_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Passport Google Strategy
// Updated Google OAuth configuration
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'https://coinacademia.in/auth/google/callback',
  passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ 
      $or: [
        { googleId: profile.id },
        { email: profile.emails[0].value }
      ]
    });

    if (!user) {
      user = await User.create({
        googleId: profile.id,
        username: profile.displayName,
        email: profile.emails[0].value,
        isVerified: true
      });
    } else if (!user.googleId) {
      // Merge existing account with Google auth
      user.googleId = profile.id;
      await user.save();
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

// Passport serialization/deserialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Static files
app.use(express.static(__dirname));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// NOWPayments endpoint with improved error handling
app.post('/api/create-checkout', async (req, res) => {
  try {
    const { price_amount, order_id, order_description, success_url } = req.body;
    
    if (!price_amount || !order_id || !order_description) {
      return res.status(400).json({ error: 'Missing required payment details' });
    }

    const domain = process.env.DOMAIN_URL || `http://localhost:${PORT}`;
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
    console.error('Payment error:', err.response?.data || err.message);
    res.status(500).json({ 
      error: 'Failed to create checkout',
      details: err.response?.data || err.message
    });
  }
});

// Webhook endpoint with validation
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = JSON.parse(req.body.toString());
    console.log('Webhook received:', event);

    if (event.payment_status === 'finished') {
      console.log(`Payment confirmed for order ${event.order_id}`);
      // Implement your business logic here
    }

    res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send('Invalid webhook data');
  }
});

// User registration with validation
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (await User.findOne({ $or: [{ username }, { email }] })) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({ username, password: hashedPassword, email });
    await user.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User login with better security
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1h' }
    );

    res.json({ 
      message: 'Login successful', 
      token,
      user: { id: user._id, username: user.username }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Google OAuth routes
// Updated Google auth routes
app.get('/auth/google', (req, res, next) => {
  const state = req.query.redirect || '/';
  const authenticator = passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: Buffer.from(state).toString('base64'),
    prompt: 'select_account'
  });
  authenticator(req, res, next);
});

app.get('/auth/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/login.html',
    failureFlash: true,
    session: true 
  }),
  (req, res) => {
    try {
      const state = req.query.state 
        ? Buffer.from(req.query.state, 'base64').toString() 
        : '/';
      
      // Create JWT token
      const token = jwt.sign(
        { 
          id: req.user._id,
          username: req.user.username,
          email: req.user.email 
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Redirect with token
      res.redirect(`${state}?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user._id,
        username: req.user.username,
        email: req.user.email
      }))}`);
    } catch (err) {
      console.error('Google auth callback error:', err);
      res.redirect('/login.html?error=auth_failed');
    }
  }
);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString() 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 http://localhost:${PORT}`);
});