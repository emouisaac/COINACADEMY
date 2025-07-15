// main.js - Handles NOWPayments checkout from frontend

document.getElementById('buyBtn').onclick = async function() {
  const statusDiv = document.getElementById('error');
  statusDiv.textContent = '';
  try {
    // Call backend to create a NOWPayments invoice
    const res = await fetch('/api/create-checkout', { method: 'POST' });
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
