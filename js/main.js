// main.js - Handles NOWPayments checkout from frontend

document.getElementById('buyBtn').onclick = async function() {
  const statusDiv = document.getElementById('error');
  statusDiv.textContent = '';
  try {
    // Get the current page's filename for redirect after payment
    const redirectUrl = window.location.pathname.split('/').pop();
    // Call backend to create a NOWPayments invoice, sending intended redirect
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success_url: redirectUrl })
    });
    const data = await res.json();
    if (data.hosted_url) {
      // Redirect user to NOWPayments invoice page
      window.location.href = data.hosted_url;
    } else {
      statusDiv.textContent = 'Failed to start payment.';
    }
  } catch (e) {
    statusDiv.textContent = 'Error: ' + e.message;
  }
};
