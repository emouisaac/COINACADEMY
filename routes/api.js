const express = require('express');
const router = express.Router();

// Sample data (replace with database queries in production)
const courses = [
  {
    title: 'Crypto Fundamentals',
    description: 'Learn the basics of blockchain, wallets, and transactions.',
    duration: '4 weeks',
    level: 'Beginner',
    image: 'https://via.placeholder.com/300x200?text=Crypto+Basics'
  },
  // ... other courses
];

const blogs = [
  {
    title: 'Bitcoin Halving 2024: What to Expect',
    date: 'May 15, 2024',
    summary: 'An in-depth analysis of the upcoming Bitcoin halving event.',
    image: 'https://via.placeholder.com/300x200?text=Bitcoin'
  },
  // ... other blogs
];

// API endpoints
router.get('/courses', (req, res) => {
  res.json(courses);
});

router.get('/blogs', (req, res) => {
  res.json(blogs);
});

router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString() 
  });
});

module.exports = router;