import express from 'express';
import YahooFinance from 'yahoo-finance2';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import swaggerUi from 'swagger-ui-express';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const app = express();
app.enable('trust proxy');
app.use(express.json());
const PORT = 3000;

const CONFIG_PATH = process.env.CONFIG_PATH || '/data/portfolio.json';

// --- Swagger / OpenAPI ---
const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Stock Overview API',
    version: '1.0.0',
    description: 'Backend proxy API for the Stock Overview Dashboard. Provides real-time stock quotes, historical chart data, ticker search, exchange rates, and portfolio management.',
    contact: { name: 'Jacob Hornbech', url: 'https://github.com/hornbech/stocktickergui' }
  },
  servers: [{ url: '/api', description: 'API proxy (via nginx)' }],
  tags: [
    { name: 'Stock Data', description: 'Real-time quotes, search, and chart data from Yahoo Finance' },
    { name: 'Portfolio', description: 'CRUD operations for tickers and holdings, persisted to config/portfolio.json' },
    { name: 'Currency', description: 'Exchange rates from the Frankfurter API' },
    { name: 'System', description: 'Health check and diagnostics' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Returns a simple status object to verify the API is running.',
        responses: {
          '200': {
            description: 'API is healthy',
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } } }
          }
        }
      }
    },
    '/quote/{symbols}': {
      get: {
        tags: ['Stock Data'],
        summary: 'Get real-time quotes',
        description: 'Fetch real-time quotes for one or more ticker symbols. Quotes are cached for 10 seconds per symbol. Supports any symbol recognized by Yahoo Finance (US, UK, European, etc.).',
        parameters: [{
          name: 'symbols',
          in: 'path',
          required: true,
          description: 'Comma-separated ticker symbols (e.g., `AAPL,MSFT,CNA.L`)',
          schema: { type: 'string', example: 'AAPL,MSFT' }
        }],
        responses: {
          '200': {
            description: 'Array of quote objects',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/StockQuote' } } } }
          },
          '400': { description: 'No symbols provided' },
          '500': { description: 'Yahoo Finance API error' }
        }
      }
    },
    '/search': {
      get: {
        tags: ['Stock Data'],
        summary: 'Search for tickers',
        description: 'Search for equity and ETF tickers by company name or symbol. Returns up to 10 results.',
        parameters: [{
          name: 'q',
          in: 'query',
          required: true,
          description: 'Search query (company name or ticker symbol)',
          schema: { type: 'string', example: 'Apple' }
        }],
        responses: {
          '200': {
            description: 'Array of search results',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/SearchResult' } } } }
          },
          '400': { description: 'Missing query parameter `q`' },
          '500': { description: 'Yahoo Finance API error' }
        }
      }
    },
    '/chart/{symbol}': {
      get: {
        tags: ['Stock Data'],
        summary: 'Get historical chart data',
        description: 'Fetch OHLCV (Open, High, Low, Close, Volume) candlestick data for a symbol. The `time` field is a Unix timestamp in seconds, compatible with TradingView Lightweight Charts.',
        parameters: [
          { name: 'symbol', in: 'path', required: true, description: 'Ticker symbol', schema: { type: 'string', example: 'AAPL' } },
          { name: 'range', in: 'query', required: false, description: 'Time range', schema: { type: 'string', enum: ['1d', '5d', '1mo', '3mo', '1y', '5y'], default: '1mo' } },
          { name: 'interval', in: 'query', required: false, description: 'Candle interval', schema: { type: 'string', enum: ['5m', '15m', '1d', '1wk', '1mo'], default: '1d' } }
        ],
        responses: {
          '200': {
            description: 'Array of OHLCV data points',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ChartDataPoint' } } } }
          },
          '500': { description: 'Yahoo Finance API error' }
        }
      }
    },
    '/news': {
      get: {
        tags: ['Stock Data'],
        summary: 'Get news headlines',
        description: 'Fetch recent news headlines from Yahoo Finance RSS feeds for one or more symbols. Results are deduplicated by GUID and sorted newest-first. Cached for 1 minute per symbol.',
        parameters: [
          { name: 'symbols', in: 'query', required: true, description: 'Comma-separated ticker symbols', schema: { type: 'string', example: 'AAPL,MSFT' } },
          { name: 'limit', in: 'query', required: false, description: 'Maximum number of news items to return', schema: { type: 'integer', default: 20, example: 30 } }
        ],
        responses: {
          '200': {
            description: 'Array of news items sorted by date descending',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/NewsItem' } } } }
          },
          '500': { description: 'RSS feed fetch error' }
        }
      }
    },
    '/currency/rates': {
      get: {
        tags: ['Currency'],
        summary: 'Get exchange rates',
        description: 'Returns all exchange rates relative to USD, sourced from the Frankfurter API. Cached for 5 minutes. Includes synthetic sub-unit rates: `GBp` (pence = GBP × 100) and `ILA` (agorot = ILS × 100).',
        responses: {
          '200': {
            description: 'Object mapping currency codes to their USD exchange rate',
            content: {
              'application/json': {
                schema: { type: 'object', additionalProperties: { type: 'number' } },
                example: { USD: 1, DKK: 6.4835, GBP: 0.75708, GBp: 75.708, EUR: 0.86768, SEK: 9.5421 }
              }
            }
          }
        }
      }
    },
    '/portfolio': {
      get: {
        tags: ['Portfolio'],
        summary: 'Get portfolio config',
        description: 'Returns the full portfolio configuration including display currency preference, tracked tickers, and holdings with GAK (average purchase price).',
        responses: {
          '200': { description: 'Portfolio config', content: { 'application/json': { schema: { $ref: '#/components/schemas/PortfolioConfig' } } } }
        }
      },
      put: {
        tags: ['Portfolio'],
        summary: 'Replace portfolio config',
        description: 'Overwrites the entire portfolio configuration. The config is validated and persisted to `config/portfolio.json`.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PortfolioConfig' } } }
        },
        responses: {
          '200': { description: 'Updated portfolio config', content: { 'application/json': { schema: { $ref: '#/components/schemas/PortfolioConfig' } } } },
          '400': { description: 'Invalid config body' }
        }
      }
    },
    '/portfolio/ticker': {
      post: {
        tags: ['Portfolio'],
        summary: 'Add a ticker',
        description: 'Add a ticker symbol to the watchlist. Duplicates are ignored. The symbol is uppercased automatically.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['symbol'], properties: { symbol: { type: 'string', example: 'NVDA' } } } } }
        },
        responses: {
          '200': { description: 'Updated portfolio config', content: { 'application/json': { schema: { $ref: '#/components/schemas/PortfolioConfig' } } } },
          '400': { description: 'Missing symbol' }
        }
      }
    },
    '/portfolio/ticker/{symbol}': {
      delete: {
        tags: ['Portfolio'],
        summary: 'Remove a ticker',
        description: 'Remove a ticker from the watchlist and delete its associated holding (if any).',
        parameters: [{
          name: 'symbol',
          in: 'path',
          required: true,
          description: 'Ticker symbol to remove',
          schema: { type: 'string', example: 'NVDA' }
        }],
        responses: {
          '200': { description: 'Updated portfolio config', content: { 'application/json': { schema: { $ref: '#/components/schemas/PortfolioConfig' } } } }
        }
      }
    },
    '/portfolio/holding': {
      put: {
        tags: ['Portfolio'],
        summary: 'Update a holding',
        description: 'Add or update a holding (shares and average purchase price / GAK). Set both `shares` and `avgPrice` to `0` to remove the holding. The `avgPrice` should be in the stock\'s native currency.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['symbol', 'shares', 'avgPrice'],
                properties: {
                  symbol: { type: 'string', example: 'AAPL' },
                  shares: { type: 'number', example: 25 },
                  avgPrice: { type: 'number', description: 'Average purchase price per share (GAK) in the stock\'s native currency', example: 142.50 }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Updated portfolio config', content: { 'application/json': { schema: { $ref: '#/components/schemas/PortfolioConfig' } } } },
          '400': { description: 'Missing symbol' }
        }
      }
    },
    '/portfolio/pension': {
      get: {
        tags: ['Portfolio'],
        summary: 'Get pension portfolio',
        description: 'Returns pension portfolio holdings separate from regular holdings.',
        responses: {
          '200': { description: 'Pension portfolio config', content: { 'application/json': { schema: { $ref: '#/components/schemas/PensionPortfolio' } } } }
        }
      }
    },
    '/portfolio/pension/holding': {
      put: {
        tags: ['Portfolio'],
        summary: 'Update pension holding',
        description: 'Add or update a pension portfolio holding. Set both `shares` and `avgPrice` to `0` to remove.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['symbol', 'shares', 'avgPrice'],
                properties: {
                  symbol: { type: 'string', example: 'FXAIX' },
                  shares: { type: 'number', example: 100 },
                  avgPrice: { type: 'number', description: 'Average purchase price per share', example: 180.50 }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Updated pension portfolio', content: { 'application/json': { schema: { $ref: '#/components/schemas/PensionPortfolio' } } } }
        }
      }
    },
    '/portfolio/pension/ticker/{symbol}': {
      delete: {
        tags: ['Portfolio'],
        summary: 'Remove pension ticker',
        description: 'Remove a ticker from the pension portfolio.',
        parameters: [{
          name: 'symbol',
          in: 'path',
          required: true,
          description: 'Ticker symbol to remove',
          schema: { type: 'string', example: 'FXAIX' }
        }],
        responses: {
          '200': { description: 'Updated pension portfolio' }
        }
      }
    }
  },
  components: {
    schemas: {
      StockQuote: {
        type: 'object',
        description: 'Real-time quote data for a single stock',
        properties: {
          symbol: { type: 'string', example: 'AAPL' },
          shortName: { type: 'string', example: 'Apple Inc.' },
          currency: { type: 'string', description: 'Native trading currency (e.g., USD, GBp, DKK, EUR)', example: 'USD' },
          regularMarketPrice: { type: 'number', example: 255.92 },
          regularMarketChange: { type: 'number', example: 0.29 },
          regularMarketChangePercent: { type: 'number', example: 0.11 },
          regularMarketDayHigh: { type: 'number', example: 256.13 },
          regularMarketDayLow: { type: 'number', example: 250.65 },
          regularMarketVolume: { type: 'integer', example: 26686584 },
          averageDailyVolume3Month: { type: 'integer', example: 47781611 },
          regularMarketPreviousClose: { type: 'number', example: 255.63 },
          fiftyTwoWeekHigh: { type: 'number', example: 288.62 },
          fiftyTwoWeekLow: { type: 'number', example: 169.21 },
          marketCap: { type: 'integer', example: 3761492983808 },
          trailingPE: { type: 'number', nullable: true, example: 32.35 },
          marketState: { type: 'string', enum: ['PRE', 'REGULAR', 'POST', 'POSTPOST', 'CLOSED'], description: 'Current market session state', example: 'REGULAR' },
          preMarketPrice: { type: 'number', nullable: true, example: 256.10 },
          preMarketChange: { type: 'number', nullable: true, example: 0.47 },
          preMarketChangePercent: { type: 'number', nullable: true, example: 0.18 },
          postMarketPrice: { type: 'number', nullable: true, example: 255.35 },
          postMarketChange: { type: 'number', nullable: true, example: -0.57 },
          postMarketChangePercent: { type: 'number', nullable: true, example: -0.22 },
          beta: { type: 'number', nullable: true, example: 1.28, description: 'Beta measures volatility relative to the market' },
          dividendYield: { type: 'number', nullable: true, example: 0.55, description: 'Annual dividend yield as percentage' },
          epsTrailingTwelveMonths: { type: 'number', nullable: true, example: 6.57, description: 'Trailing 12-month EPS' },
          epsForward: { type: 'number', nullable: true, example: 7.28, description: 'Forward EPS estimate' },
          fiftyDayAverage: { type: 'number', nullable: true, example: 252.30, description: '50-day moving average price' },
          twoHundredDayAverage: { type: 'number', nullable: true, example: 235.80, description: '200-day moving average price' },
          fiftyDayAverageChangePercent: { type: 'number', nullable: true, example: 1.44, description: 'Price change vs 50-day MA (%)' },
          twoHundredDayAverageChangePercent: { type: 'number', nullable: true, example: 8.54, description: 'Price change vs 200-day MA (%)' },
          analystTargetPrice: { type: 'number', nullable: true, example: 280.00, description: 'Mean analyst price target' },
          recommendationKey: { type: 'string', nullable: true, example: 'buy', description: 'Analyst recommendation: strongBuy, buy, hold, sell, strongSell' },
          numberOfAnalystRatings: { type: 'integer', nullable: true, example: 42, description: 'Number of analysts covering the stock' }
        }
      },
      SearchResult: {
        type: 'object',
        description: 'Ticker search result',
        properties: {
          symbol: { type: 'string', example: 'AAPL' },
          name: { type: 'string', example: 'Apple Inc.' },
          exchange: { type: 'string', example: 'NMS' },
          type: { type: 'string', enum: ['EQUITY', 'ETF'], example: 'EQUITY' }
        }
      },
      ChartDataPoint: {
        type: 'object',
        description: 'Single OHLCV candlestick data point',
        properties: {
          time: { type: 'integer', description: 'Unix timestamp in seconds', example: 1772548200 },
          open: { type: 'number', example: 263.48 },
          high: { type: 'number', example: 265.56 },
          low: { type: 'number', example: 260.13 },
          close: { type: 'number', example: 263.75 },
          volume: { type: 'integer', example: 38568900 }
        }
      },
      PortfolioConfig: {
        type: 'object',
        description: 'Full portfolio configuration, persisted to config/portfolio.json',
        properties: {
          currency: { type: 'string', enum: ['USD', 'DKK', 'EUR', 'GBP', 'SEK', 'NOK', 'CHF', 'CAD', 'AUD'], description: 'Display currency for portfolio summary totals', example: 'USD' },
          tickers: { type: 'array', items: { type: 'string' }, description: 'List of tracked ticker symbols', example: ['AAPL', 'MSFT', 'CNA.L'] },
          holdings: { type: 'array', items: { $ref: '#/components/schemas/Holding' }, description: 'Portfolio positions' },
          pensionHoldings: { type: 'array', items: { $ref: '#/components/schemas/Holding' }, description: 'Pension/retirement portfolio positions' }
        }
      },
      Holding: {
        type: 'object',
        description: 'A single portfolio position',
        properties: {
          symbol: { type: 'string', example: 'AAPL' },
          shares: { type: 'number', description: 'Number of shares held', example: 10 },
          avgPrice: { type: 'number', description: 'Average purchase price per share (GAK) in the stock\'s native currency. Set to 0 if unknown.', example: 150.00 }
        }
      },
      PensionPortfolio: {
        type: 'object',
        description: 'Pension portfolio configuration',
        properties: {
          holdings: { type: 'array', items: { $ref: '#/components/schemas/Holding' }, description: 'Pension portfolio positions' }
        }
      },
      NewsItem: {
        type: 'object',
        description: 'A single news headline from Yahoo Finance RSS',
        properties: {
          title: { type: 'string', example: 'Apple Reports Record Q1 Revenue' },
          link: { type: 'string', example: 'https://finance.yahoo.com/news/...' },
          pubDate: { type: 'string', example: 'Fri, 04 Apr 2026 14:30:00 +0000' },
          source: { type: 'string', example: 'Reuters' },
          guid: { type: 'string', example: 'https://finance.yahoo.com/news/...' },
          symbols: { type: 'array', items: { type: 'string' }, example: ['AAPL'] }
        }
      }
    }
  }
};

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Stock Overview API Docs'
}));

// --- Caches ---
const quoteCache = new Map();
const QUOTE_TTL = 10_000; // 10 seconds

let currencyCache = { rate: null, timestamp: 0 };
const CURRENCY_TTL = 300_000; // 5 minutes

const newsCache = new Map();
const NEWS_TTL = 60_000; // 1 minute

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

// Get news for one or more symbols
app.get('/api/news', async (req, res) => {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [];
    
    if (symbols.length === 0) {
      return res.json([]);
    }

    async function fetchNewsForSymbol(symbol) {
      const cacheKey = `news_${symbol}`;
      const cached = newsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < NEWS_TTL) {
        return cached.data;
      }

      try {
        const rssUrl = `https://finance.yahoo.com/rss/finance?symbols=${encodeURIComponent(symbol)}`;
        const response = await fetch(rssUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml'
          }
        });

        if (!response.ok) {
          return [];
        }

        const xml = await response.text();
        const items = parseRSSItems(xml);
        return items.map(item => ({
          ...item,
          symbols: [symbol]
        }));
      } catch (err) {
        console.error(`News fetch error for ${symbol}:`, err.message);
        return [];
      }
    }

    function parseRSSItems(xml) {
      const items = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;

      while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];
        
        const titleMatch = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(itemXml);
        const linkMatch = /<link>([\s\S]*?)<\/link>/.exec(itemXml);
        const pubDateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(itemXml);
        const sourceMatch = /<source[^>]*url="([^"]*)"[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/.exec(itemXml) ||
                            /<source[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/.exec(itemXml);
        const guidMatch = /<guid[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/.exec(itemXml);

        if (titleMatch) {
          let title = titleMatch[1].trim();
          title = title.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();

          let source = 'Yahoo Finance';
          if (sourceMatch) {
            source = (sourceMatch[2] || sourceMatch[1] || 'Yahoo Finance').trim();
            source = source.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
          }

          let link = '';
          if (linkMatch) {
            link = linkMatch[1].trim();
          }
          if (!link && guidMatch) {
            link = guidMatch[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
          }

          items.push({
            title,
            link,
            pubDate: pubDateMatch ? pubDateMatch[1].trim() : '',
            source,
            guid: guidMatch ? guidMatch[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim() : ''
          });
        }
      }

      return items;
    }

    const allNews = [];
    for (const symbol of symbols) {
      const news = await fetchNewsForSymbol(symbol);
      allNews.push(...news);
    }

    allNews.sort((a, b) => {
      const dateA = new Date(a.pubDate);
      const dateB = new Date(b.pubDate);
      return dateB.getTime() - dateA.getTime();
    });

    const seen = new Set();
    const uniqueNews = allNews.filter(item => {
      if (seen.has(item.guid)) return false;
      seen.add(item.guid);
      return true;
    });

    const limit = parseInt(req.query.limit) || 20;
    res.json(uniqueNews.slice(0, limit));
  } catch (err) {
    console.error('News error:', err.message);
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

function getDefaultConfig() {
  return {
    activePortfolio: 'default',
    portfolios: {
      default: { currency: 'USD', tickers: [], holdings: [] },
      pension: { currency: 'USD', tickers: [], holdings: [] }
    }
  };
}

function readConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
      if (config.portfolios) {
        return config;
      }
    }
  } catch (err) {
    console.error('Failed to read config:', err.message);
  }
  return getDefaultConfig();
}

function writeConfig(config) {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write config:', err.message);
  }
}

function getDefaultPortfolio() {
  return { currency: 'USD', tickers: [], holdings: [] };
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
  if (!config.portfolios) {
    config.portfolios = getDefaultConfig().portfolios;
  }
  if (!config.portfolios.default) {
    config.portfolios.default = getDefaultPortfolio();
  }
  if (!config.portfolios.pension) {
    config.portfolios.pension = getDefaultPortfolio();
  }
  writeConfig(config);
  res.json(config);
});

// Add a ticker to default portfolio
app.post('/api/portfolio/ticker', (req, res) => {
  const { symbol } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  const config = readConfig();
  const upper = symbol.toUpperCase();
  if (!config.portfolios.default.tickers.includes(upper)) {
    config.portfolios.default.tickers.push(upper);
    writeConfig(config);
  }
  res.json(config);
});

// Remove a ticker from default portfolio
app.delete('/api/portfolio/ticker/:symbol', (req, res) => {
  const upper = req.params.symbol.toUpperCase();
  const config = readConfig();
  config.portfolios.default.tickers = config.portfolios.default.tickers.filter(t => t !== upper);
  writeConfig(config);
  res.json(config);
});

// Update a holding in default portfolio (GAK/shares)
app.put('/api/portfolio/holding', (req, res) => {
  const { symbol, shares, avgPrice } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  const config = readConfig();
  const upper = symbol.toUpperCase();
  const holdings = config.portfolios.default.holdings;
  const idx = holdings.findIndex(h => h.symbol === upper);

  if (shares === 0 && avgPrice === 0) {
    config.portfolios.default.holdings = holdings.filter(h => h.symbol !== upper);
  } else if (idx >= 0) {
    holdings[idx] = { symbol: upper, shares, avgPrice };
  } else {
    holdings.push({ symbol: upper, shares, avgPrice });
  }
  writeConfig(config);
  res.json(config);
});

// --- Pension Portfolio ---

function getPensionHoldings() {
  const config = readConfig();
  return config.portfolios?.pension?.holdings || [];
}

function writePensionHoldings(holdings) {
  const config = readConfig();
  if (!config.portfolios) {
    config.portfolios = getDefaultConfig().portfolios;
  }
  if (!config.portfolios.pension) {
    config.portfolios.pension = getDefaultPortfolio();
  }
  config.portfolios.pension.holdings = holdings;
  writeConfig(config);
}

// Get pension portfolio
app.get('/api/portfolio/pension', (_req, res) => {
  res.json({ holdings: getPensionHoldings() });
});

// Update pension holding
app.put('/api/portfolio/pension/holding', (req, res) => {
  const { symbol, shares, avgPrice } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  const holdings = getPensionHoldings();
  const upper = symbol.toUpperCase();
  const idx = holdings.findIndex(h => h.symbol === upper);

  if (shares === 0 && avgPrice === 0) {
    writePensionHoldings(holdings.filter(h => h.symbol !== upper));
  } else if (idx >= 0) {
    holdings[idx] = { symbol: upper, shares, avgPrice };
    writePensionHoldings(holdings);
  } else {
    holdings.push({ symbol: upper, shares, avgPrice });
    writePensionHoldings(holdings);
  }
  res.json({ holdings: getPensionHoldings() });
});

// Remove pension ticker
app.delete('/api/portfolio/pension/ticker/:symbol', (req, res) => {
  const upper = req.params.symbol.toUpperCase();
  const holdings = readPensionHoldings().filter(h => h.symbol !== upper);
  writePensionHoldings(holdings);
  res.json({ holdings });
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
    postMarketChangePercent: q.postMarketChangePercent,
    beta: q.beta,
    dividendYield: q.dividendYield != null ? round(q.dividendYield) : null,
    epsTrailingTwelveMonths: q.epsTrailingTwelveMonths,
    epsForward: q.epsForward,
    fiftyDayAverage: q.fiftyDayAverage,
    twoHundredDayAverage: q.twoHundredDayAverage,
    fiftyDayAverageChangePercent: q.fiftyDayAverageChangePercent,
    twoHundredDayAverageChangePercent: q.twoHundredDayAverageChangePercent,
    analystTargetPrice: q.analystTargetPrice,
    recommendationKey: q.recommendationKey,
    numberOfAnalystRatings: q.numberOfAnalystRatings
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
