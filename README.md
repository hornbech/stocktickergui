# Stock Overview Dashboard

A real-time stock ticker dashboard for tracking equities and ETFs across global markets. Built with Angular 19, an Express.js backend proxy, and packaged in Docker for one-command deployment.

![Docker](https://img.shields.io/badge/Docker-required-blue) ![Angular](https://img.shields.io/badge/Angular-19-red) ![Node](https://img.shields.io/badge/Node-22-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [API Reference](#api-reference)
  - [Swagger UI](#swagger-ui)
  - [Stock Data](#stock-data)
  - [Portfolio Management](#portfolio-management)
  - [Currency](#currency)
  - [Stats](#stats)
- [Currency Handling](#currency-handling)
- [Data Sources](#data-sources)
- [Local Development](#local-development)
- [Troubleshooting](#troubleshooting)

---

## Features

### Dashboard Tabs

The application has four main tabs:

| Tab | Description |
|-----|-------------|
| **Overview** | Portfolio summary showing Holdings + Pension totals, P&L, combined value, chart selector, and news ticker |
| **Watchlist** | Track stocks you're interested in with search/add functionality, stock cards, chart, and news ticker |
| **Holdings** | Your investment positions with stock cards, interactive chart on selection, detailed P&L table, and news ticker |
| **Pension** | Pension/retirement portfolio with same layout as Holdings: stock cards, chart, table, news ticker |

### Stock Tracking

- **Real-time stock quotes** with 30-second auto-refresh (pauses when the browser tab is hidden)
- **Ticker search** with autocomplete via Yahoo Finance (supports equities and ETFs)
- **Market status indicator** per ticker (Pre-Market, Open, After Hours, Closed)
- **Pre-market and after-hours** prices shown when the market is in extended hours
- **Stock cards** showing price, change, day range, volume, market cap, P/E, 52-week range

### Charts & Technical Indicators

- **Interactive candlestick charts** powered by TradingView Lightweight Charts
- **Chart ranges**: 1D, 5D (default), 1M, 3M, 1Y, 5Y
- **Trend indicators** (toggleable):
  - EMA(20) - cyan
  - SMA(50) - orange
  - SMA(200) - purple
  - Bollinger Bands (20, 2σ) - purple
- **RSI(14)** sub-panel with overbought (>70) / oversold (<30) levels
- **MACD(12,26,9)** sub-panel with histogram
- **Volume** sub-panel with 20-day MA

All indicators are calculated client-side from OHLCV data.

### News Ticker

- **Scrolling news feed** at the top of Overview, Watchlist, Holdings, and Pension tabs
- Fetches news from Yahoo Finance RSS feeds for all watched symbols
- Auto-scrolling animation with pause on hover
- Shows ticker symbol badges, headline, and source
- Auto-refreshes every 60 seconds
- Duplicate detection by GUID for deduplication

### Portfolio Management

- **GAK/GAV tracking** -- enter your average purchase price (GAK) and number of shares to see unrealized P&L
- **Holdings tab** -- track your investment positions with add/remove functionality
- **Pension tab** -- separate tracking for retirement accounts
- **Overview tab** -- combined view of all portfolios with totals

### Currency Support

- **Multi-currency display** -- each stock shows prices in its native currency
- **Currency dropdown** -- choose from USD, DKK, EUR, GBP, SEK, NOK, CHF, CAD, AUD
- **Sub-unit currency support** -- GBp (pence) and ILA (agorot) auto-converted

### Mobile Support

- **Responsive layout** -- automatically adapts to phone screens (< 768px viewport)
- **Compact header** -- stacked layout with smaller title and hidden exchange rate
- **Scrollable tabs** -- horizontal scroll for the view toggle on narrow screens
- **Stacked cards** -- single-column grid for stock cards and overview summaries
- **Mobile-friendly tables** -- holdings/pension tables switch to a 2-column card layout with hidden header row
- **Shorter charts** -- main chart 250px, sub-panels 80px to fit phone screens
- **Touch-friendly inputs** -- 16px font on inputs to prevent iOS auto-zoom

### Infrastructure

- **File-based persistence** -- portfolio config stored in `config/portfolio.json`
- **Dark theme** with responsive layout
- **No API keys required** -- uses Yahoo Finance and Frankfurter API
- **Information page** with total visitor counter (persisted) and real-time online users count
- **Swagger UI** at [`/api/docs/`](http://localhost:8080/api/docs/)

---

## Quick Start

**Prerequisites:** Docker and Docker Compose

```bash
# 1. Clone the repository
git clone https://github.com/hornbech/stocktickergui.git
cd stocktickergui

# 2. Create your portfolio config from the example
cp config/portfolio.example.json config/portfolio.json

# 3. (Optional) Enable password protection
cp .env.example .env
# Edit .env and set DASHBOARD_PASSWORD=your-password

# 4. Build and run
docker compose up --build
```

Open **http://localhost:8080** in your browser.

To run in the background:

```bash
docker compose up --build -d
```

To stop:

```bash
docker compose down
```

---

## Configuration

### Portfolio Config File

The application reads and writes `config/portfolio.json` at runtime. This file is volume-mounted into the container, so it persists across restarts.

A boilerplate is provided at `config/portfolio.example.json`:

```json
{
  "activePortfolio": "default",
  "portfolios": {
    "default": {
      "currency": "USD",
      "tickers": ["AAPL", "MSFT"],
      "holdings": [
        { "symbol": "AAPL", "shares": 50, "avgPrice": 150.00 }
      ]
    },
    "pension": {
      "currency": "USD",
      "tickers": [],
      "holdings": [
        { "symbol": "FXAIX", "shares": 100, "avgPrice": 180.00 }
      ]
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `activePortfolio` | `string` | Currently active portfolio (not used in UI) |
| `portfolios.default.currency` | `string` | Display currency for watchlist/holdings totals |
| `portfolios.default.tickers` | `string[]` | Ticker symbols to track |
| `portfolios.default.holdings` | `object[]` | Your positions with `symbol`, `shares`, `avgPrice` |
| `portfolios.pension.currency` | `string` | Display currency for pension totals |
| `portfolios.pension.tickers` | `string[]` | Pension fund tickers to track |
| `portfolios.pension.holdings` | `object[]` | Pension positions |

### Authentication

The dashboard includes optional password authentication for internet-facing deployments. When enabled, all routes (API and frontend) are protected behind a login screen.

#### Setup

1. Copy the example environment file and set your password:

```bash
cp .env.example .env
```

2. Edit `.env` and set your password:

```env
DASHBOARD_PASSWORD=your-secure-password
```

3. Start the container (Docker Compose reads `.env` automatically):

```bash
docker compose up --build -d
```

That's it. Open `http://localhost:8080` and you'll see a login screen.

**To disable authentication**, leave `DASHBOARD_PASSWORD` empty or remove it from `.env`. The app works exactly as before with no login required.

#### Auth bypass for demo sites

To let a specific hostname skip authentication (e.g., a public demo), add this to `.env`:

```env
AUTH_BYPASS_HOST=demo.hhornbech.dk
```

Visitors accessing `https://demo.hhornbech.dk` see the dashboard without logging in. All other hostnames still require the password.

#### Session persistence

By default, sessions are lost when the container restarts. To keep users logged in across restarts, generate a secret and add it to `.env`:

```bash
# Generate and append to .env
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
```

#### Security details

| Feature | Details |
|---------|---------|
| Password hashing | bcrypt (cost factor 12) |
| Session duration | 7 days (rolling, activity-based) |
| Brute force protection | 10 attempts / 15 min per IP + exponential lockout |
| Cookie security | httpOnly, sameSite strict |
| Minimum password length | 8 characters |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DASHBOARD_PASSWORD` | _(empty)_ | Set to enable authentication (min 8 characters). Leave empty to disable. |
| `AUTH_BYPASS_HOST` | _(empty)_ | Hostname that bypasses authentication (e.g., `demo.hhornbech.dk`) |
| `SESSION_SECRET` | _(random)_ | Secret for signing session cookies. Set for session persistence across restarts. |
| `CONFIG_PATH` | `/data/portfolio.json` | Path to the portfolio config file inside the container |
| `STATS_PATH` | `/data/stats.json` | Path to the visitor stats file inside the container |

### Tunable Parameters

| Parameter | Location | Default | Description |
|-----------|----------|---------|-------------|
| Host port | `docker-compose.yml` | `8080` | Port exposed on the host machine |
| Auto-refresh interval | `dashboard.component.ts` | `30000` ms | How often quotes are fetched |
| Quote cache TTL | `proxy/server.js` | `10000` ms | How long quotes are cached |
| Currency rate cache TTL | `proxy/server.js` | `300000` ms | How long exchange rates are cached |
| News cache TTL | `proxy/server.js` | `60000` ms | How long news is cached |
| Chart cache TTL | `proxy/server.js` | Range-dependent | 1min (1D), 5min (5D), 1hr (1M/3M), 24hr (1Y/5Y) |
| Heartbeat TTL | `proxy/server.js` (`HEARTBEAT_TTL`) | `45000` ms | How long before an idle user is considered offline |
| Heartbeat interval | `frontend/src/app/services/stats.service.ts` | `20000` ms | How often the client sends a heartbeat ping |

---

## Architecture

### System Overview

```
                   ┌──────────────────────────────────────────────────┐
                   │              Docker Container                    │
                   │                                                  │
┌─────────┐       │  ┌──────────┐         ┌────────────────────┐     │
│         │  :80  │  │          │  /api/*  │                    │     │
│ Browser ├──────►│  │  nginx   ├────────► │  Express Proxy     │     │
│         │◄──────┤  │          │◄────────┤│  (localhost:3000)  │     │
└─────────┘       │  └────┬─────┘         └──────┬─────────────┘     │
                  │       │                      │                    │
                  │       │ Static files         │ Yahoo Finance     │
                  │       │ (Angular SPA)        │ Frankfurter API   │
                  │       │                      │ RSS feeds         │
                  │  /usr/share/nginx/html   /data/portfolio.json     │
                  └──────────────────────────────────────────────────┘
                                                 │
                                           ┌─────┴─────┐
                                           │  ./config  │  (volume mount)
                                           └───────────┘
```

**nginx** serves the pre-built Angular SPA as static files and reverse-proxies all `/api/*` requests to the Express backend.

**Express proxy** handles all external API calls (Yahoo Finance, Frankfurter) and manages the portfolio config file.

**Angular SPA** is a standalone single-page application using Angular 19 signals for state management.

### Docker Build Stages

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| `frontend-build` | `node:22-alpine` | Builds Angular production bundle |
| `proxy-deps` | `node:22-alpine` | Installs Express proxy dependencies |
| Runtime | `node:22-alpine` + nginx | Serves Angular files and runs Express |

### Frontend Structure

```
frontend/src/app/
├── app.component.ts              # Root component
├── app.config.ts               # Angular providers
├── models/
│   ├── stock.model.ts          # StockQuote, ChartDataPoint, SearchResult, NewsItem
│   └── portfolio.model.ts      # PortfolioEntry
├── services/
│   ├── stock.service.ts        # HTTP client for /api/* (quotes, search, chart, news)
│   ├── currency.service.ts      # Exchange rates, formatting
│   ├── portfolio.service.ts    # Portfolio CRUD, syncs with backend
│   └── stats.service.ts        # Visitor counting and online user heartbeat tracking
└── components/
    ├── dashboard/               # Main layout, 4 tabs (Overview/Watchlist/Holdings/Pension)
    ├── ticker-input/           # Search input with autocomplete
    ├── stock-card/             # Per-ticker card: price, stats
    ├── stock-chart/            # TradingView charts with indicators
    ├── holdings-summary/       # Holdings tab: stock cards, chart, table, news ticker
    ├── pension-summary/        # Pension tab: stock cards, chart, table, news ticker
    ├── currency-toggle/        # Currency dropdown (USD, DKK, EUR, GBP, SEK, NOK, CHF, CAD, AUD)
    ├── market-status/          # Market state badge
    ├── news-ticker/            # Scrolling news feed from Yahoo RSS
    └── info-page/              # Information page with visitor counter and online users
```

All components use Angular standalone components (no NgModules). State is managed with signals.

### Backend Proxy

`proxy/server.js` is a single-file Express server (ESM) with these responsibilities:

- **Quote fetching** via `yahoo-finance2` v3 with 10-second per-symbol cache
- **Ticker search** via Yahoo Finance search API
- **Chart data** via Yahoo Finance chart API
- **News feeds** via Yahoo Finance RSS feeds, parsed and deduplicated
- **Exchange rates** via Frankfurter API, cached for 5 minutes
- **Portfolio CRUD** reading/writing `config/portfolio.json`
- **Stats tracking** with persistent visitor counter and heartbeat-based online user tracking

---

## API Reference

All endpoints are served at `/api/*` and proxied by nginx.

### Swagger UI

Interactive API documentation available at:

```
http://localhost:8080/api/docs/
```

### Stock Data

#### `GET /api/quote/:symbols`

Fetch real-time quotes for one or more comma-separated symbols.

```
GET /api/quote/AAPL,MSFT,CNA.L
```

**Response:** Array of quote objects with price, change, volume, market cap, P/E, indicators.

#### `GET /api/search?q=:query`

Search for tickers by name or symbol.

```
GET /api/search?q=Apple
```

#### `GET /api/chart/:symbol?range=:range&interval=:interval`

Fetch OHLCV chart data.

| Parameter | Values | Description |
|-----------|--------|-------------|
| `range` | `1d`, `5d`, `1mo`, `3mo`, `1y`, `5y` | Time range |
| `interval` | `5m`, `15m`, `1d`, `1wk`, `1mo` | Candle interval |

#### `GET /api/news?symbols=:symbols&limit=:limit`

Fetch news from Yahoo Finance RSS feeds for specified symbols.

| Parameter | Description |
|-----------|-------------|
| `symbols` | Comma-separated ticker symbols (e.g., `AAPL,MSFT`) |
| `limit` | Maximum number of news items (default: 20) |

```
GET /api/news?symbols=AAPL,MSFT&limit=30
```

**Response:** Array of news items with title, link, source, pubDate, guid.

#### `GET /api/health`

Health check endpoint.

```json
{ "status": "ok" }
```

### Portfolio Management

#### `GET /api/portfolio`

Returns the full portfolio config with nested structure.

#### `PUT /api/portfolio`

Overwrites the entire portfolio config.

#### `POST /api/portfolio/ticker`

Add a ticker to the watchlist.

```json
{ "symbol": "NVDA" }
```

#### `DELETE /api/portfolio/ticker/:symbol`

Remove a ticker from the watchlist.

```
DELETE /api/portfolio/ticker/NVDA
```

#### `PUT /api/portfolio/holding`

Add or update a holding.

```json
{ "symbol": "AAPL", "shares": 25, "avgPrice": 142.50 }
```

#### `GET /api/portfolio/pension`

Returns pension portfolio holdings.

#### `PUT /api/portfolio/pension/holding`

Add or update a pension holding.

```json
{ "symbol": "FXAIX", "shares": 50, "avgPrice": 190.00 }
```

#### `DELETE /api/portfolio/pension/ticker/:symbol`

Remove a ticker from the pension portfolio.

### Currency

#### `GET /api/currency/rates`

Returns exchange rates relative to USD from Frankfurter API (cached 5 min).

```json
{
  "USD": 1,
  "DKK": 6.4835,
  "GBP": 0.75708,
  "GBp": 75.708,
  "EUR": 0.86768
}
```

Includes synthetic sub-unit rates: `GBp` (British pence = GBP x 100) and `ILA` (Israeli agorot = ILS x 100).

### Stats

#### `GET /api/stats`

Returns current visitor count and online user count.

```json
{ "totalVisitors": 1042, "onlineUsers": 3 }
```

#### `POST /api/stats/visit`

Increments the visitor counter and returns updated stats. Called once per page load by the frontend.

#### `POST /api/stats/heartbeat`

Keeps a user session alive for online tracking. Clients send this every 20 seconds with a unique session ID. Sessions expire after 45 seconds of inactivity.

```json
{ "sessionId": "abc123xyz" }
```

---

## Currency Handling

| Context | Currency used |
|---------|--------------|
| Stock price on card | Native |
| Day range, 52-week range | Native |
| Portfolio summary totals | Display (user's choice) |
| Holdings/Pension tables | Display |

**Sub-unit currencies:** GBp (pence) and ILA (agorot) are automatically converted to major units.

---

## Data Sources

| Data | Source | API Key | Cache |
|------|--------|---------|-------|
| Stock quotes | Yahoo Finance via `yahoo-finance2` | Not required | 10 sec |
| Ticker search | Yahoo Finance | Not required | None |
| Chart data | Yahoo Finance | Not required | Range-dependent (1min--24hr) |
| News feeds | Yahoo Finance RSS | Not required | 1 min |
| Exchange rates | Frankfurter API | Not required | 5 min |

---

## Local Development

For development outside Docker, you need Node.js 22+.

**Terminal 1 -- Backend proxy:**

```bash
cd proxy
npm install
CONFIG_PATH=../config/portfolio.json node server.js
```

**Terminal 2 -- Angular frontend:**

```bash
cd frontend
npm install
npx ng serve --proxy-config proxy.conf.json
```

Create `frontend/proxy.conf.json`:

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false
  }
}
```

---

## Troubleshooting

**Container exits immediately**

```bash
docker logs stockoverview-stockoverview-1
cp config/portfolio.example.json config/portfolio.json
```

**Yahoo Finance rate limiting (HTTP 429)**

Increase `QUOTE_TTL` in `proxy/server.js`. Restart the container.

**Quotes not updating**

The dashboard pauses auto-refresh when the browser tab is hidden.

**Port 8080 is already in use**

Change in `docker-compose.yml`:

```yaml
ports:
  - "3080:80"
```

**Docker build fails**

```bash
docker compose build --no-cache
```

**News ticker not showing**

Check browser console for errors. Ensure symbols are added to watchlist, holdings, or pension.

---

## License & Contributing

This project is open source, created by **Jacob Hornbech**.

Feature requests and merge requests are welcome — feel free to open an issue or submit an MR!
