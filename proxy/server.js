import express from 'express';
import YahooFinance from 'yahoo-finance2';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import swaggerUi from 'swagger-ui-express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import path from 'path';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const app = express();
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '10kb' }));

// --- Authentication ---
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';
const AUTH_ENABLED = DASHBOARD_PASSWORD.length > 0;
const AUTH_BYPASS_HOST = process.env.AUTH_BYPASS_HOST || ''; // hostname that skips auth (e.g. demo.example.com)

let passwordHash = null;
if (AUTH_ENABLED) {
  if (DASHBOARD_PASSWORD.length < 8) {
    console.error('FATAL: DASHBOARD_PASSWORD must be at least 8 characters');
    process.exit(1);
  }
  passwordHash = bcrypt.hashSync(DASHBOARD_PASSWORD, 12);
  // Best-effort clear from env
  delete process.env.DASHBOARD_PASSWORD;
  console.log('Authentication enabled — login required');
  if (AUTH_BYPASS_HOST) {
    console.log(`Authentication bypass enabled for host: ${AUTH_BYPASS_HOST}`);
  }

  const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
  app.use(session({
    name: 'sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: false, // set to true if behind HTTPS
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    },
  }));
} else {
  console.log('Authentication disabled — no DASHBOARD_PASSWORD set');
}

// Brute force protection
let failedAttempts = 0;
let lockoutUntil = 0;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function bruteForceCheck(_req, res, next) {
  const now = Date.now();
  if (now < lockoutUntil) {
    const waitSec = Math.ceil((lockoutUntil - now) / 1000);
    return res.status(429).json({ error: `Locked out. Try again in ${waitSec}s.` });
  }
  next();
}

function recordFailedLogin() {
  failedAttempts++;
  console.warn(`Failed login attempt #${failedAttempts}`);
  if (failedAttempts >= 3) {
    const delaySec = Math.min(Math.pow(2, failedAttempts - 3), 900);
    lockoutUntil = Date.now() + delaySec * 1000;
  }
}

function recordSuccessfulLogin() {
  failedAttempts = 0;
  lockoutUntil = 0;
}

// --- Input validation ---
const SYMBOL_RE = /^[A-Z0-9.\-^=]{1,20}$/;
const VALID_RANGES = ['1d', '5d', '1mo', '3mo', '1y', '5y'];
const VALID_INTERVALS = ['1m', '2m', '5m', '15m', '1d', '1wk', '1mo'];

function validateSymbol(s) {
  return SYMBOL_RE.test(s);
}

function stripProto(obj) {
  if (obj && typeof obj === 'object') {
    delete obj.__proto__;
    delete obj.constructor;
    delete obj.prototype;
  }
  return obj;
}

// --- Rate limiting ---
const apiLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use('/api/', apiLimiter);

// --- Auth routes (before auth wall) ---
app.post('/api/auth/login', loginLimiter, bruteForceCheck, async (req, res) => {
  if (!AUTH_ENABLED) return res.json({ success: true });

  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password required' });
  }

  const match = await bcrypt.compare(password, passwordHash);
  if (!match) {
    recordFailedLogin();
    return res.status(401).json({ error: 'Invalid password' });
  }

  recordSuccessfulLogin();
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.authenticated = true;
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: 'Session error' });
      res.json({ success: true });
    });
  });
});

app.post('/api/auth/logout', (req, res) => {
  if (!AUTH_ENABLED) return res.json({ success: true });
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('sid', { path: '/' });
    res.json({ success: true });
  });
});

app.get('/api/auth/status', (req, res) => {
  if (!AUTH_ENABLED) return res.json({ authenticated: true, authEnabled: false });
  if (AUTH_BYPASS_HOST && req.hostname === AUTH_BYPASS_HOST) {
    return res.json({ authenticated: true, authEnabled: false });
  }
  res.json({ authenticated: req.session?.authenticated === true, authEnabled: true });
});

// --- Auth wall (auth routes are registered above, so they match before this runs) ---
app.use((req, res, next) => {
  if (!AUTH_ENABLED) return next();
  if (AUTH_BYPASS_HOST && req.hostname === AUTH_BYPASS_HOST) return next();
  if (req.session?.authenticated === true) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next(); // Let nginx serve the Angular app (which shows login)
});
const PORT = 3000;

const CONFIG_PATH = process.env.CONFIG_PATH || '/data/portfolio.json';
const STATS_PATH = process.env.STATS_PATH || '/data/stats.json';
const CACHE_PATH = process.env.CACHE_PATH || path.join(path.dirname(CONFIG_PATH), 'cache.json');

// --- JSON File Cache ---
const CHART_TTL = {
  '1d':  60_000,       // 1 minute
  '5d':  300_000,      // 5 minutes
  '1mo': 3_600_000,    // 1 hour
  '3mo': 3_600_000,    // 1 hour
  '1y':  86_400_000,   // 24 hours
  '5y':  86_400_000,   // 24 hours
};

function readCache() {
  try {
    if (existsSync(CACHE_PATH)) {
      return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to read cache:', err.message);
  }
  return { charts: {}, currency: null };
}

function writeCache(cache) {
  try {
    writeFileSync(CACHE_PATH, JSON.stringify(cache), 'utf-8');
  } catch (err) {
    console.error('Failed to write cache:', err.message);
  }
}

function getCachedChart(symbol, range, interval) {
  const cache = readCache();
  const key = `${symbol}|${range}|${interval}`;
  const entry = cache.charts?.[key];
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  return null;
}

function setCachedChart(symbol, range, interval, data) {
  const cache = readCache();
  const key = `${symbol}|${range}|${interval}`;
  const ttl = CHART_TTL[range] || 3_600_000;
  if (!cache.charts) cache.charts = {};
  cache.charts[key] = { data, expiresAt: Date.now() + ttl };
  writeCache(cache);
}

function getCachedCurrency() {
  const cache = readCache();
  const entry = cache.currency;
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  return null;
}

function setCachedCurrency(rates) {
  const cache = readCache();
  cache.currency = { data: rates, expiresAt: Date.now() + CURRENCY_TTL };
  writeCache(cache);
}

// Purge expired chart entries periodically (every hour)
setInterval(() => {
  try {
    const cache = readCache();
    const now = Date.now();
    let purged = 0;
    for (const key of Object.keys(cache.charts || {})) {
      if (cache.charts[key].expiresAt < now) {
        delete cache.charts[key];
        purged++;
      }
    }
    if (purged > 0) {
      writeCache(cache);
      console.log(`Cache cleanup: purged ${purged} expired chart entries`);
    }
  } catch (err) {
    console.error('Cache cleanup error:', err.message);
  }
}, 3_600_000);

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
    { name: 'System', description: 'Health check and diagnostics' },
    { name: 'Stats', description: 'Visitor counter and online user tracking' }
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
          { name: 'interval', in: 'query', required: false, description: 'Candle interval', schema: { type: 'string', enum: ['1m', '2m', '5m', '15m', '1d', '1wk', '1mo'], default: '1d' } }
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
    '/stats': {
      get: {
        tags: ['Stats'],
        summary: 'Get current stats',
        description: 'Returns the total visitor count and current number of online users.',
        responses: {
          '200': {
            description: 'Stats object',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Stats' } } }
          }
        }
      }
    },
    '/stats/visit': {
      post: {
        tags: ['Stats'],
        summary: 'Record a visit',
        description: 'Increments the total visitor counter and returns updated stats.',
        responses: {
          '200': {
            description: 'Updated stats',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Stats' } } }
          }
        }
      }
    },
    '/stats/heartbeat': {
      post: {
        tags: ['Stats'],
        summary: 'Send heartbeat',
        description: 'Keeps a user session alive for online user tracking. Clients should call this every 20 seconds.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['sessionId'], properties: { sessionId: { type: 'string', example: 'abc123xyz' } } } } }
        },
        responses: {
          '200': {
            description: 'Updated stats',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Stats' } } }
          },
          '400': { description: 'Missing sessionId' }
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
      Stats: {
        type: 'object',
        description: 'Visitor and online user statistics',
        properties: {
          totalVisitors: { type: 'integer', description: 'All-time total page visits', example: 1042 },
          onlineUsers: { type: 'integer', description: 'Number of currently active users', example: 3 }
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

// --- Online users tracking ---
const onlineUsers = new Map(); // sessionId -> lastSeen timestamp
const HEARTBEAT_TTL = 45_000; // 45 seconds (clients ping every 20s)

function cleanupStaleUsers() {
  const now = Date.now();
  for (const [id, lastSeen] of onlineUsers) {
    if (now - lastSeen > HEARTBEAT_TTL) {
      onlineUsers.delete(id);
    }
  }
}

// Cleanup every 15 seconds
setInterval(cleanupStaleUsers, 15_000);

// --- Stats persistence ---
function readStats() {
  try {
    if (existsSync(STATS_PATH)) {
      return JSON.parse(readFileSync(STATS_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to read stats:', err.message);
  }
  return { totalVisitors: 0 };
}

function writeStats(stats) {
  try {
    writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write stats:', err.message);
  }
}

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

const SERVER_START_TIME = new Date().toISOString();

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', startedAt: SERVER_START_TIME });
});

// Get quotes for one or more symbols (comma-separated)
app.get('/api/quote/:symbols', async (req, res) => {
  try {
    const symbols = req.params.symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (symbols.length === 0) return res.status(400).json({ error: 'No symbols provided' });
    if (symbols.length > 50) return res.status(400).json({ error: 'Too many symbols (max 50)' });
    if (!symbols.every(validateSymbol)) return res.status(400).json({ error: 'Invalid symbol format' });

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
    res.status(500).json({ error: 'Failed to fetch quotes' });
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
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get chart data for a symbol
app.get('/api/chart/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    if (!validateSymbol(symbol)) return res.status(400).json({ error: 'Invalid symbol format' });
    const range = req.query.range || '1mo';
    const interval = req.query.interval || '1d';
    if (!VALID_RANGES.includes(range)) return res.status(400).json({ error: 'Invalid range' });
    if (!VALID_INTERVALS.includes(interval)) return res.status(400).json({ error: 'Invalid interval' });

    const cached = getCachedChart(symbol, range, interval);
    if (cached) return res.json(cached);

    const isIntraday = ['1m', '2m', '5m', '15m'].includes(interval);

    const result = await yahooFinance.chart(symbol, {
      period1: getStartDate(range),
      interval: interval,
      ...(isIntraday && { includePrePost: true })
    });

    if (!result || !result.quotes) {
      return res.json({ data: [] });
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

    const response = { data };

    if (isIntraday && result.meta) {
      const tz = result.meta.exchangeTimezoneName;
      const regular = result.meta.currentTradingPeriod?.regular;
      if (tz && regular && regular.start && regular.end) {
        const extractTime = (date) => {
          const parts = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
          }).formatToParts(date);
          const h = parts.find(p => p.type === 'hour').value;
          const m = parts.find(p => p.type === 'minute').value;
          return `${h}:${m}`;
        };
        response.regularHours = {
          timezone: tz,
          open: extractTime(regular.start),
          close: extractTime(regular.end)
        };
      }
    }

    setCachedChart(symbol, range, interval, response);
    res.json(response);
  } catch (err) {
    console.error('Chart error:', err.message);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

// Get news for one or more symbols
app.get('/api/news', async (req, res) => {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [];

    if (symbols.length === 0) return res.json([]);
    if (symbols.length > 50) return res.status(400).json({ error: 'Too many symbols (max 50)' });
    if (!symbols.every(validateSymbol)) return res.status(400).json({ error: 'Invalid symbol format' });

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

    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    res.json(uniqueNews.slice(0, limit));
  } catch (err) {
    console.error('News error:', err.message);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// Get exchange rates (all rates relative to USD)
app.get('/api/currency/rates', async (_req, res) => {
  try {
    // Fast path: in-memory
    if (currencyCache.rate && Date.now() - currencyCache.timestamp < CURRENCY_TTL) {
      return res.json(currencyCache.rate);
    }

    // Warm path: disk cache (survives restarts)
    const diskCached = getCachedCurrency();
    if (diskCached) {
      currencyCache = { rate: diskCached, timestamp: Date.now() };
      return res.json(diskCached);
    }

    // Cold path: fetch from Frankfurter
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
    setCachedCurrency(rates);
    res.json(rates);
  } catch (err) {
    console.error('Currency error:', err.message);
    // Fallback chain: in-memory -> disk (ignore expiry) -> hardcoded
    if (currencyCache.rate) return res.json(currencyCache.rate);
    const diskFallback = readCache().currency?.data;
    if (diskFallback) return res.json(diskFallback);
    res.json({ USD: 1, DKK: 6.85, GBP: 0.79, GBp: 79 });
  }
});

// --- Stats ---

// Record a new visit and return stats
app.post('/api/stats/visit', (req, res) => {
  const stats = readStats();
  stats.totalVisitors = (stats.totalVisitors || 0) + 1;
  writeStats(stats);
  cleanupStaleUsers();
  res.json({ totalVisitors: stats.totalVisitors, onlineUsers: onlineUsers.size });
});

// Heartbeat - keeps session alive
app.post('/api/stats/heartbeat', (req, res) => {
  const sessionId = req.body.sessionId;
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 64) {
    return res.status(400).json({ error: 'Invalid sessionId' });
  }
  if (onlineUsers.size > 10_000 && !onlineUsers.has(sessionId)) {
    cleanupStaleUsers();
    if (onlineUsers.size > 10_000) return res.status(429).json({ error: 'Too many sessions' });
  }
  onlineUsers.set(sessionId, Date.now());
  cleanupStaleUsers();
  res.json({ totalVisitors: readStats().totalVisitors, onlineUsers: onlineUsers.size });
});

// Get current stats
app.get('/api/stats', (_req, res) => {
  cleanupStaleUsers();
  res.json({ totalVisitors: readStats().totalVisitors, onlineUsers: onlineUsers.size });
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

// Save full portfolio config (with optional portfolio parameter)
app.put('/api/portfolio', writeLimiter, (req, res) => {
  const config = stripProto(req.body);
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
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
app.post('/api/portfolio/ticker', writeLimiter, (req, res) => {
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
  config.portfolios.default.holdings = config.portfolios.default.holdings.filter(h => h.symbol !== upper);
  writeConfig(config);
  res.json(config);
});

// Update a holding in default portfolio (GAK/shares)
app.put('/api/portfolio/holding', writeLimiter, (req, res) => {
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
app.put('/api/portfolio/pension/holding', writeLimiter, (req, res) => {
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
  const holdings = getPensionHoldings().filter(h => h.symbol !== upper);
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
