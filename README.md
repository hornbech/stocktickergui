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

### Infrastructure

- **File-based persistence** -- portfolio config stored in `config/portfolio.json`
- **Dark theme** with responsive layout
- **No API keys required** -- uses Yahoo Finance and Frankfurter API
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

# 3. Build and run
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

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONFIG_PATH` | `/data/portfolio.json` | Path to the portfolio config file inside the container |

### Tunable Parameters

| Parameter | Location | Default | Description |
|-----------|----------|---------|-------------|
| Host port | `docker-compose.yml` | `8080` | Port exposed on the host machine |
| Auto-refresh interval | `dashboard.component.ts` | `30000` ms | How often quotes are fetched |
| Quote cache TTL | `proxy/server.js` | `10000` ms | How long quotes are cached |
| Currency rate cache TTL | `proxy/server.js` | `300000` ms | How long exchange rates are cached |
| News cache TTL | `proxy/server.js` | `60000` ms | How long news is cached |

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
│   └── portfolio.service.ts    # Portfolio CRUD, syncs with backend
└── components/
    ├── dashboard/               # Main layout, 4 tabs (Overview/Watchlist/Holdings/Pension)
    ├── ticker-input/           # Search input with autocomplete
    ├── stock-card/             # Per-ticker card: price, stats
    ├── stock-chart/            # TradingView charts with indicators
    ├── holdings-summary/       # Holdings tab: stock cards, chart, table, news ticker
    ├── pension-summary/        # Pension tab: stock cards, chart, table, news ticker
    ├── currency-toggle/        # Currency dropdown (USD, DKK, EUR, GBP, SEK, NOK, CHF, CAD, AUD)
    ├── market-status/          # Market state badge
    └── news-ticker/            # Scrolling news feed from Yahoo RSS
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
| Chart data | Yahoo Finance | Not required | None |
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
