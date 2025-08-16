require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const cors = require('cors');
const bodyParser = require('body-parser');
// const authRoutes = require('./routes/auth');
require('./config/passport');
const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');



const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(session({ secret: process.env.SESSION_SECRET || 'secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname));

// Serve index.html for all main routes (SPA)
app.get(['/', '/courses', '/about', '/blogs', '/affiliate', '/login'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ...existing code continues...


  

// NOWPayments endpoint
app.post('/api/create-checkout', async (req, res) => {
  try {
    const { price_amount, order_id, order_description, success_url } = req.body;
    
    if (!price_amount || !order_id || !order_description) {
      return res.status(400).json({ error: 'Missing required payment details' });
    }

  const domain = process.env.CLIENT_URL || 'https://www.coinacademia.in';
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

// Webhook endpoint
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = JSON.parse(req.body.toString());
    console.log('Webhook received:', event);

    if (event.payment_status === 'finished') {
      console.log(`Payment confirmed for order ${event.order_id}`);
    }

    res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send('Invalid webhook data');
  }
});



// Google OAuth routes
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
      
      const token = jwt.sign(
        { 
          id: req.user._id,
          username: req.user.username,
          email: req.user.email 
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

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

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

// Initialize app


// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cryptoacademy', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport initialization
require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// SPA routes
const spaRoutes = ['/', '/courses', '/about', '/blogs', '/affiliate', '/login'];
spaRoutes.forEach(route => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const startServer = async () => {
  await connectDB();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔗 http://localhost:${PORT}`);
  });
};

startServer();


const TransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  // ... transaction fields
});

module.exports = mongoose.model('Transaction', TransactionSchema);

