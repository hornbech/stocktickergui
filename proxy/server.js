import express from 'express';
import YahooFinance from 'yahoo-finance2';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const app = express();
app.use(express.json());
const PORT = 3000;

const CONFIG_PATH = process.env.CONFIG_PATH || '/data/portfolio.json';

// --- Caches ---
const quoteCache = new Map();
const QUOTE_TTL = 10_000; // 10 seconds

let currencyCache = { rate: null, timestamp: 0 };
const CURRENCY_TTL = 300_000; // 5 minutes

// --- Helpers ---
function getCachedQuote(symbol) {
  const entry = quoteCache.get(symbol);
  if (entry && Date.now() - entry.timestamp < QUOTE_TTL) return entry.data;
  return null;
}

function setCachedQuote(symbol, data) {
  quoteCache.set(symbol, { data, timestamp: Date.now() });
}

// --- Routes ---

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Get quotes for one or more symbols (comma-separated)
app.get('/api/quote/:symbols', async (req, res) => {
  try {
    const symbols = req.params.symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (symbols.length === 0) return res.status(400).json({ error: 'No symbols provided' });

    const results = [];
    const toFetch = [];

    for (const sym of symbols) {
      const cached = getCachedQuote(sym);
      if (cached) {
        results.push(cached);
      } else {
        toFetch.push(sym);
      }
    }

    if (toFetch.length > 0) {
      // yahoo-finance2 quote accepts array
      const quotes = await yahooFinance.quote(toFetch);
      const arr = Array.isArray(quotes) ? quotes : [quotes];
      for (const q of arr) {
        const mapped = mapQuote(q);
        setCachedQuote(mapped.symbol, mapped);
        results.push(mapped);
      }
    }

    res.json(results);
  } catch (err) {
    console.error('Quote error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Search for tickers
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing query param q' });

    const results = await yahooFinance.search(query, { newsCount: 0 });
    const mapped = (results.quotes || [])
      .filter(q => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
      .slice(0, 10)
      .map(q => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchange,
        type: q.quoteType
      }));

    res.json(mapped);
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get chart data for a symbol
app.get('/api/chart/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const range = req.query.range || '1mo';
    const interval = req.query.interval || '1d';

    const result = await yahooFinance.chart(symbol, {
      period1: getStartDate(range),
      interval: interval
    });

    if (!result || !result.quotes) {
      return res.json([]);
    }

    const data = result.quotes
      .filter(q => q.open !== null && q.close !== null)
      .map(q => ({
        time: Math.floor(new Date(q.date).getTime() / 1000),
        open: round(q.open),
        high: round(q.high),
        low: round(q.low),
        close: round(q.close),
        volume: q.volume || 0
      }));

    res.json(data);
  } catch (err) {
    console.error('Chart error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get exchange rates (all rates relative to USD)
app.get('/api/currency/rates', async (_req, res) => {
  try {
    if (currencyCache.rate && Date.now() - currencyCache.timestamp < CURRENCY_TTL) {
      return res.json(currencyCache.rate);
    }

    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=USD');
    const data = await response.json();
    const rates = data.rates || {};

    // Add USD itself and GBp (pence = GBP / 100)
    rates['USD'] = 1;
    if (rates['GBP']) {
      rates['GBp'] = rates['GBP'] * 100; // 1 USD = X pence
    }
    // ILA (Israeli Agorot) = ILS / 100
    if (rates['ILS']) {
      rates['ILA'] = rates['ILS'] * 100;
    }

    currencyCache = { rate: rates, timestamp: Date.now() };
    res.json(rates);
  } catch (err) {
    console.error('Currency error:', err.message);
    res.json(currencyCache.rate || { USD: 1, DKK: 6.85, GBP: 0.79, GBp: 79 });
  }
});

// --- Portfolio Config ---

function readConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to read config:', err.message);
  }
  return { currency: 'USD', tickers: [], holdings: [] };
}

function writeConfig(config) {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write config:', err.message);
  }
}

// Get full portfolio config
app.get('/api/portfolio', (_req, res) => {
  res.json(readConfig());
});

// Save full portfolio config
app.put('/api/portfolio', (req, res) => {
  const config = req.body;
  if (!config || typeof config !== 'object') {
    return res.status(400).json({ error: 'Invalid config' });
  }
  // Ensure valid structure
  const sanitized = {
    currency: config.currency || 'USD',
    tickers: Array.isArray(config.tickers) ? config.tickers : [],
    holdings: Array.isArray(config.holdings) ? config.holdings : []
  };
  writeConfig(sanitized);
  res.json(sanitized);
});

// Add a ticker
app.post('/api/portfolio/ticker', (req, res) => {
  const { symbol } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  const config = readConfig();
  const upper = symbol.toUpperCase();
  if (!config.tickers.includes(upper)) {
    config.tickers.push(upper);
    writeConfig(config);
  }
  res.json(config);
});

// Remove a ticker
app.delete('/api/portfolio/ticker/:symbol', (req, res) => {
  const upper = req.params.symbol.toUpperCase();
  const config = readConfig();
  config.tickers = config.tickers.filter(t => t !== upper);
  config.holdings = config.holdings.filter(h => h.symbol !== upper);
  writeConfig(config);
  res.json(config);
});

// Update a holding (GAK/shares)
app.put('/api/portfolio/holding', (req, res) => {
  const { symbol, shares, avgPrice } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  const config = readConfig();
  const upper = symbol.toUpperCase();
  const idx = config.holdings.findIndex(h => h.symbol === upper);

  if (shares === 0 && avgPrice === 0) {
    config.holdings = config.holdings.filter(h => h.symbol !== upper);
  } else if (idx >= 0) {
    config.holdings[idx] = { symbol: upper, shares, avgPrice };
  } else {
    config.holdings.push({ symbol: upper, shares, avgPrice });
  }
  writeConfig(config);
  res.json(config);
});

// --- Helpers ---

function mapQuote(q) {
  return {
    symbol: q.symbol,
    shortName: q.shortName || q.longName || q.symbol,
    currency: q.currency || 'USD',
    regularMarketPrice: q.regularMarketPrice,
    regularMarketChange: q.regularMarketChange,
    regularMarketChangePercent: q.regularMarketChangePercent,
    regularMarketDayHigh: q.regularMarketDayHigh,
    regularMarketDayLow: q.regularMarketDayLow,
    regularMarketVolume: q.regularMarketVolume,
    averageDailyVolume3Month: q.averageDailyVolume3Month,
    regularMarketPreviousClose: q.regularMarketPreviousClose,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow,
    marketCap: q.marketCap,
    trailingPE: q.trailingPE,
    marketState: q.marketState,
    preMarketPrice: q.preMarketPrice,
    preMarketChange: q.preMarketChange,
    preMarketChangePercent: q.preMarketChangePercent,
    postMarketPrice: q.postMarketPrice,
    postMarketChange: q.postMarketChange,
    postMarketChangePercent: q.postMarketChangePercent
  };
}

function getStartDate(range) {
  const now = new Date();
  switch (range) {
    case '1d': now.setDate(now.getDate() - 1); break;
    case '5d': now.setDate(now.getDate() - 5); break;
    case '1mo': now.setMonth(now.getMonth() - 1); break;
    case '3mo': now.setMonth(now.getMonth() - 3); break;
    case '1y': now.setFullYear(now.getFullYear() - 1); break;
    case '5y': now.setFullYear(now.getFullYear() - 5); break;
    default: now.setMonth(now.getMonth() - 1);
  }
  return now;
}

function round(n) {
  return n != null ? Math.round(n * 100) / 100 : null;
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Proxy server running on http://127.0.0.1:${PORT}`);
});
