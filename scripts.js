async function fetchMarketData() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=100');
    const data = await res.json();

    const ticker = data.map(coin => {
      const change = coin.price_change_percentage_24h;
      const changeClass = change >= 0 ? 'green' : 'red';
      return `<span class="orange">${coin.name}</span>: <span class="${changeClass}">$${coin.current_price.toLocaleString()}</span>`;
    }).join(' <span class="divider">|</span> ');
    document.getElementById('coin-ticker').innerHTML = ticker;

    const coinList = data.slice(0, 10).map(coin => {
      const change = coin.price_change_percentage_24h;
      const changeClass = change >= 0 ? 'green' : 'red';
      return `
        <tr>
          <td class="orange">${coin.name}</td>
          <td class="${change >= 0 ? 'green' : 'red'}">$${coin.current_price.toLocaleString()}</td>
          <td class="${changeClass}">${change.toFixed(2)}%</td>
          <td>$${coin.market_cap.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    document.getElementById('coin-list').innerHTML = coinList;

    const marketCap = data.reduce((acc, coin) => acc + coin.market_cap, 0);
    const volume = data.reduce((acc, coin) => acc + coin.total_volume, 0);

    document.getElementById('marketCap').textContent = '$' + (marketCap / 1e9).toFixed(2) + 'B';
    document.getElementById('volume').textContent = '$' + (volume / 1e9).toFixed(2) + 'B';
    document.getElementById('activeCryptos').textContent = data.length;
    document.getElementById('btcDominance').textContent = 'Loading...';
  } catch (e) {
    console.error(e);
  }
}

function countUp(id, end, duration) {
  let start = 0;
  const increment = end / (duration / 50);
  const counter = setInterval(() => {
    start += increment;
    if (start >= end) {
      start = end;
      clearInterval(counter);
    }
    document.getElementById(id).textContent = Math.floor(start);
  }, 50);
}

fetchMarketData();
setInterval(fetchMarketData, 30000);
countUp("student-count", 5000, 3000);
