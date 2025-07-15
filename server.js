// Load environment variables from .env file
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, './'))); // Serves files from paytest/

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
    const response = await axios.post(
      'https://api.nowpayments.io/v1/invoice',
      {
        price_amount: 90.00,
        price_currency: 'usd',
        order_id: 'STARTER_PARK',
        order_description: 'Crypto course package at 10% off! (Original: $100, Now: $90)',
        success_url: `${process.env.DOMAIN_URL || 'http://localhost:' + PORT}/course-unlocked.html`,
        cancel_url: `${process.env.DOMAIN_URL || 'http://localhost:' + PORT}/index.html`
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
  // Check if payment is confirmed and for the correct amount
  if (
    event.payment_status === 'finished' &&
    event.price_amount == 90.00 &&
    event.order_id === 'STARTER_PARK'
  ) {
    // Grant access to course (e.g., update DB, send email, etc.)
    console.log('NOWPayments: Payment confirmed for STARTER PARK! Access granted.');
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

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
