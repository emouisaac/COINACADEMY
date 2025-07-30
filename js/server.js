// Load environment variables from .env file
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');

const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes (allow all origins)
app.use(cors());

// Serve static frontend files (HTML, CSS, JS) from project root
app.use(express.static(path.join(__dirname, '..')));

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
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

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
