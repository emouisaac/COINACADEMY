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

// Set the port from environment variable or default to 3000
const PORT = process.env.PORT || 3001;

// Initialize app
const app = express();

// Database connection
const clientPromise = require('./db');

// Connect Mongoose to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Mongoose connected to MongoDB Atlas'))
  .catch((err) => console.error('Mongoose connection error:', err));

// Middleware setup
app.use(cors({
  origin: [
    'https://coinacademia.in',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.JWT_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Passport Google Strategy
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
        name: profile.displayName,
        isVerified: true
      });
    } else if (!user.googleId) {
      user.googleId = profile.id;
      user.name = profile.displayName;
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

// User authentication middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1] || req.cookies.token;
  
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Get current user endpoint
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -googleId');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('User fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// User registration endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email, name } = req.body;
    
    if (!username || !password || !email || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (await User.findOne({ $or: [{ username }, { email }] })) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({ username, password: hashedPassword, email, name });
    await user.save();

    // Generate token
    const token = jwt.sign(
      { id: user._id, username: user.username, name: user.name }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.status(201).json({ 
      message: 'User registered successfully',
      token,
      user: { id: user._id, username: user.username, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User login endpoint
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
      { id: user._id, username: user.username, name: user.name }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({ 
      message: 'Login successful', 
      token,
      user: { 
        id: user._id, 
        username: user.username, 
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
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
          name: req.user.name,
          email: req.user.email 
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.redirect(`${state}?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user._id,
        username: req.user.username,
        name: req.user.name,
        email: req.user.email
      }))}`);
    } catch (err) {
      console.error('Google auth callback error:', err);
      res.redirect('/login.html?error=auth_failed');
    }
  }
);

// Other existing endpoints (NOWPayments, webhook, health check) remain the same
// ...

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

localStorage.setItem('coinAcademiaToken', data.token);
localStorage.setItem('coinAcademiaUser', JSON.stringify(data.user));

function updateUserNav() {
  const userData = localStorage.getItem('coinAcademiaUser');
  const userNav = document.getElementById('userNav');
  const loginNav = document.getElementById('loginNav');
  const googleLoginNav = document.getElementById('googleLoginNav');

  if (userData) {
    const user = JSON.parse(userData);
    document.getElementById('userName').textContent = user.name || user.username;
    userNav.style.display = 'block';
    loginNav.style.display = 'none';
    googleLoginNav.style.display = 'none';
  } else {
    userNav.style.display = 'none';
    loginNav.style.display = 'block';
    googleLoginNav.style.display = 'block';
  }
}

function logout() {
  localStorage.removeItem('coinAcademiaToken');
  localStorage.removeItem('coinAcademiaUser');
  // Optionally call the logout API endpoint
  fetch('/api/logout', { method: 'POST' })
    .then(() => window.location.href = '/index.html');
}