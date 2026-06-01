// Vercel serverless function — no CORS, server-side fetch to Yahoo Finance
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'ticker is required' });

  const symbol = ticker.toUpperCase().trim();

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

      const meta   = result.meta;
      const quote  = result.indicators?.quote?.[0] || {};
      const highs  = (quote.high  || []).filter(h => h != null && h > 0);
      const closes = (quote.close || []).filter(c => c != null && c > 0);
      const timestamps = (result.timestamp || []);

      if (!highs.length || !meta?.regularMarketPrice) continue;

      // Build OHLC points aligned with timestamps
      const points = timestamps.map((ts, i) => ({
        t: ts * 1000,
        c: quote.close?.[i] ?? null,
        h: quote.high?.[i]  ?? null,
        l: quote.low?.[i]   ?? null,
      })).filter(p => p.c != null);

      return res.status(200).json({
        currentPrice: meta.regularMarketPrice,
        high3m:       Math.max(...highs),
        currency:     meta.currency || 'USD',
        symbol:       meta.symbol || symbol,
        closes:       closes,          // for sparkline
        points:       points,          // {t,c,h,l} array
      });
    } catch {}
  }

  return res.status(502).json({ error: `Failed to fetch price for ${symbol}` });
}
