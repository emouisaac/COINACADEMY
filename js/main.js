document.getElementById('buyBtn').onclick = async function() {
  const statusDiv = document.getElementById('error');
  statusDiv.textContent = '';
  try {
    if (!window.location.pathname) {
      throw new Error('Cannot determine current page');
    }
    
    const redirectUrl = window.location.pathname.split('/').pop();
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success_url: redirectUrl })
    });
    
    if (!res.ok) {
      throw new Error(`Server responded with status ${res.status}`);
    }
    
    const data = await res.json();
    if (!data?.hosted_url) {
      throw new Error('Invalid response from server');
    }
    
    window.location.href = data.hosted_url;
  } catch (e) {
    statusDiv.textContent = 'Error: ' + (e.message || 'Failed to start payment');
    console.error('Payment initiation failed:', e);
  }
};