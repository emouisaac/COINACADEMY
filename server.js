require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
require('./config/passport');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(session({ secret: process.env.SESSION_SECRET || 'secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname));


// Example live data (replace with DB queries in production)
const courses = [
  {
    title: 'Crypto Fundamentals',
    description: 'Learn the basics of blockchain, wallets, and transactions.',
    duration: '4 weeks',
    level: 'Beginner',
    image: 'https://via.placeholder.com/300x200?text=Crypto+Basics'
  },
  {
    title: 'Crypto Trading Masterclass',
    description: 'Master technical analysis and trading strategies.',
    duration: '6 weeks',
    level: 'Intermediate',
    image: 'https://via.placeholder.com/300x200?text=Trading'
  },
  {
    title: 'DeFi & Smart Contracts',
    description: 'Build decentralized applications on Ethereum.',
    duration: '8 weeks',
    level: 'Advanced',
    image: 'https://via.placeholder.com/300x200?text=DeFi'
  }
];

const blogs = [
  {
    title: 'Bitcoin Halving 2024: What to Expect',
    date: 'May 15, 2024',
    summary: 'An in-depth analysis of the upcoming Bitcoin halving event and its potential market impact.',
    image: 'https://via.placeholder.com/300x200?text=Bitcoin'
  },
  {
    title: 'Ethereum 2.0: The Complete Guide',
    date: 'April 28, 2024',
    summary: 'Everything you need to know about Ethereum\'s transition to proof-of-stake.',
    image: 'https://via.placeholder.com/300x200?text=Ethereum'
  },
  {
    title: 'Top DeFi Projects to Watch in 2024',
    date: 'April 10, 2024',
    summary: 'Our analysts pick the most promising decentralized finance projects this year.',
    image: 'https://via.placeholder.com/300x200?text=DeFi'
  }
];

app.use('/api/auth', authRoutes);

// API endpoints for dynamic data
app.get('/api/courses', (req, res) => {
  res.json(courses);
});

app.get('/api/blogs', (req, res) => {
  res.json(blogs);
});


// Serve index.html for all main routes (SPA)
app.get(['/', '/courses', '/about', '/blogs', '/affiliate', '/login'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cryptoacademy';

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));


  

// NOWPayments endpoint
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
