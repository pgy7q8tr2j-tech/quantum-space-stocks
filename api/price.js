// Vercel serverless function — no CORS, server-side fetch to Yahoo Finance
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'ticker is required' });

  const symbol = ticker.toUpperCase().trim();

  // Try multiple Yahoo Finance endpoints server-side (no CORS here)
  const endpoints = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`,
  ];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://finance.yahoo.com/',
    'Origin': 'https://finance.yahoo.com',
  };

  for (const url of endpoints) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) continue;

      const json = await response.json();
      const result = json?.chart?.result?.[0];
      if (!result) continue;

      const meta = result.meta;
      const highs = (result.indicators?.quote?.[0]?.high || []).filter(h => h != null && h > 0);
      if (!highs.length || !meta?.regularMarketPrice) continue;

      return res.status(200).json({
        currentPrice: meta.regularMarketPrice,
        high3m: Math.max(...highs),
        currency: meta.currency || 'USD',
        symbol: meta.symbol || symbol,
      });
    } catch {}
  }

  return res.status(502).json({ error: `Failed to fetch price for ${symbol}` });
}
