# Stock Overview Dashboard

A real-time stock ticker dashboard for tracking equities and ETFs across global markets. Built with Angular 19, an Express.js backend proxy, and packaged in Docker for one-command deployment.

![Docker](https://img.shields.io/badge/Docker-required-blue) ![Angular](https://img.shields.io/badge/Angular-19-red) ![Node](https://img.shields.io/badge/Node-22-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [Portfolio Config File](#portfolio-config-file)
  - [Environment Variables](#environment-variables)
  - [Tunable Parameters](#tunable-parameters)
- [Architecture](#architecture)
  - [System Overview](#system-overview)
  - [Docker Build Stages](#docker-build-stages)
  - [Frontend Structure](#frontend-structure)
  - [Backend Proxy](#backend-proxy)
- [API Reference](#api-reference)
  - [Swagger UI](#swagger-ui)
  - [Stock Data](#stock-data)
  - [Portfolio Management](#portfolio-management)
  - [Currency](#currency)
- [Currency Handling](#currency-handling)
- [Data Sources](#data-sources)
- [Local Development](#local-development)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Real-time stock quotes** with 30-second auto-refresh (pauses when the browser tab is hidden)
- **Ticker search** with autocomplete via Yahoo Finance (supports equities and ETFs)
- **Interactive candlestick charts** powered by TradingView Lightweight Charts with selectable ranges: 1D, 5D (default), 1M, 3M, 1Y, 5Y
- **Technical indicators** -- EMA(20), SMA(50), SMA(200), Bollinger Bands, RSI(14), MACD, Volume with MA
- **Indicator panels** -- Main chart shows candles with MAs and Bollinger Bands; sub-panels for RSI, MACD, and Volume
- **Volume overlay** displayed alongside price data on all chart intervals
- **Pre-market and after-hours** prices shown when the market is in extended hours
- **Market status indicator** per ticker (Pre-Market, Open, After Hours, Closed)
- **Three-tab portfolio system** -- Watchlist (tracking), Holdings (investments), Pension (retirement)
- **GAK/GAV portfolio tracking** -- enter your average purchase price (GAK) and number of shares to see unrealized P&L; works without GAK too, showing just the current value
- **Multi-currency display** -- each stock shows prices in its native currency (USD, GBP, EUR, DKK, etc.) with a currency badge on the card
- **Currency dropdown** for portfolio totals -- choose from USD, DKK, EUR, GBP, SEK, NOK, CHF, CAD, or AUD; the summary table converts all holdings to your chosen display currency using live exchange rates
- **Stock card indicators** -- Beta, Dividend Yield, EPS, Analyst Rating
- **Sub-unit currency support** -- GBp (pence) is automatically converted to GBP for display; same for ILA (agorot) to ILS
- **File-based persistence** -- portfolio config is stored in `config/portfolio.json`, mounted as a Docker volume so data survives container restarts
- **Dark theme** with responsive layout that works on desktop and tablet
- **No API keys required** -- uses Yahoo Finance and Frankfurter API, both free and keyless
- **Swagger UI** at [`/api/docs/`](http://localhost:8080/api/docs/) for interactive API documentation and testing

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

No NPM, Node.js, or any other dependency is needed on your machine -- everything builds inside Docker.

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

The application reads and writes `config/portfolio.json` at runtime. This file is volume-mounted into the container, so it persists across restarts and can be edited directly.

A boilerplate is provided at `config/portfolio.example.json`:

```json
{
  "currency": "USD",
  "tickers": ["AAPL", "MSFT"],
  "holdings": [
    { "symbol": "AAPL", "shares": 50, "avgPrice": 150.00 }
  ],
  "pensionHoldings": [
    { "symbol": "FXAIX", "shares": 100, "avgPrice": 180.00 }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `currency` | `"USD"`, `"DKK"`, `"EUR"`, `"GBP"`, `"SEK"`, `"NOK"`, `"CHF"`, `"CAD"`, or `"AUD"` | Display currency for portfolio summary totals |
| `tickers` | `string[]` | List of ticker symbols to track (e.g., `"AAPL"`, `"CNA.L"`, `"NOVO-B.CO"`) |
| `holdings` | `object[]` | Your positions in regular investment accounts; each has `symbol`, `shares`, and `avgPrice` (GAK) |
| `holdings[].symbol` | `string` | Ticker symbol |
| `holdings[].shares` | `number` | Number of shares held |
| `holdings[].avgPrice` | `number` | Average purchase price per share (GAK) in the stock's native currency. Set to `0` if unknown -- the dashboard will still show the current value |
| `pensionHoldings` | `object[]` | Your positions in pension/retirement accounts (separate from regular holdings) |
| `pensionHoldings[].symbol` | `string` | Pension fund ticker (e.g., `"FXAIX"`, `"VTI"`) |
| `pensionHoldings[].shares` | `number` | Number of shares/units held |
| `pensionHoldings[].avgPrice` | `number` | Average purchase price per share |

Changes made through the web UI (adding/removing tickers, updating holdings, changing currency) are written back to this file automatically.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONFIG_PATH` | `/data/portfolio.json` | Path to the portfolio config file inside the container |

### Tunable Parameters

These are hardcoded but easy to change in the source:

| Parameter | Location | Default | Description |
|-----------|----------|---------|-------------|
| Host port | `docker-compose.yml` | `8080` | Port exposed on the host machine |
| Auto-refresh interval | `frontend/src/app/components/dashboard/dashboard.component.ts` | `30000` ms | How often quotes are fetched |
| Quote cache TTL | `proxy/server.js` (`QUOTE_TTL`) | `10000` ms | How long quotes are cached in the proxy |
| Currency rate cache TTL | `proxy/server.js` (`CURRENCY_TTL`) | `300000` ms | How long exchange rates are cached (5 min) |

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
                  │       │                      │                   │
                  │       │ Static files          │ Yahoo Finance    │
                  │       │ (Angular SPA)         │ Frankfurter API  │
                  │       │                      │                   │
                  │  /usr/share/nginx/html   /data/portfolio.json    │
                  └──────────────────────────────────────────────────┘
                                                  │
                                            ┌─────┴─────┐
                                            │  ./config  │  (volume mount)
                                            └───────────┘
```

**nginx** serves the pre-built Angular SPA as static files and reverse-proxies all `/api/*` requests to the Express backend running on `localhost:3000` inside the same container.

**Express proxy** handles all external API calls (Yahoo Finance for stock data, Frankfurter for exchange rates) and manages the portfolio config file. This avoids CORS issues and keeps external API details out of the browser.

**Angular SPA** is a standalone single-page application using Angular 19 signals for state management. It communicates exclusively with the Express proxy via `/api/*` endpoints.

### Docker Build Stages

The `Dockerfile` uses a three-stage build:

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| `frontend-build` | `node:22-alpine` | Installs Angular CLI, runs `npm install`, builds the production Angular bundle |
| `proxy-deps` | `node:22-alpine` | Installs Express proxy production dependencies |
| Runtime | `node:22-alpine` + nginx | Copies the built Angular files to nginx's HTML root, copies proxy code and node_modules, runs both nginx and the Express proxy |

The final image contains only production artifacts -- no build tools, dev dependencies, or source maps.

### Frontend Structure

```
frontend/src/app/
├── app.component.ts              # Root component, hosts the dashboard
├── app.config.ts                 # Angular providers (HttpClient, zone)
├── models/
│   ├── stock.model.ts            # StockQuote, ChartDataPoint, SearchResult, ChartRange interfaces
│   └── portfolio.model.ts        # PortfolioEntry interface
├── services/
│   ├── stock.service.ts          # HTTP client for /api/quote, /api/chart, /api/search
│   ├── currency.service.ts       # Exchange rates, formatting, native/converted display
│   └── portfolio.service.ts      # Portfolio CRUD, syncs with backend /api/portfolio
└── components/
    ├── dashboard/                # Main layout, tab management, auto-refresh
    ├── ticker-input/             # Search input with autocomplete dropdown
    ├── stock-card/               # Per-ticker card: price, change, stats, indicators
    ├── stock-chart/              # TradingView Lightweight Charts wrapper (candlestick + volume)
    ├── portfolio-summary/        # Watchlist summary table with converted totals
    ├── holdings-summary/         # Holdings tab with search and position management
    ├── pension-summary/          # Pension/retirement portfolio tracking
    ├── currency-toggle/          # Currency dropdown (USD, DKK, EUR, GBP, SEK, NOK, CHF, CAD, AUD)
    └── market-status/            # Market state indicator badge (Pre-Market, Open, etc.)
```

All components use Angular standalone components (no NgModules). State is managed with Angular signals.

### Backend Proxy

`proxy/server.js` is a single-file Express server (ESM) with these responsibilities:

- **Quote fetching** via `yahoo-finance2` v3 with a 10-second per-symbol cache
- **Ticker search** via Yahoo Finance search API, filtered to equities and ETFs
- **Chart data** via Yahoo Finance chart API, returning OHLCV data for Lightweight Charts
- **Exchange rates** via the Frankfurter API, cached for 5 minutes, with sub-unit currency support (GBp, ILA)
- **Portfolio CRUD** reading/writing `config/portfolio.json` on every mutation

---

## API Reference

All endpoints are served at `/api/*` and proxied by nginx to the Express backend.

### Swagger UI

A full interactive API documentation is available at:

```
http://localhost:8080/api/docs/
```

The Swagger UI lets you browse all endpoints, view request/response schemas, and execute API calls directly from the browser. It is powered by an OpenAPI 3.0 spec defined inline in `proxy/server.js`.

### Stock Data

#### `GET /api/quote/:symbols`

Fetch real-time quotes for one or more comma-separated symbols.

```
GET /api/quote/AAPL,MSFT,CNA.L
```

**Response:** Array of quote objects:

```json
[
  {
    "symbol": "AAPL",
    "shortName": "Apple Inc.",
    "currency": "USD",
    "regularMarketPrice": 255.92,
    "regularMarketChange": 0.29,
    "regularMarketChangePercent": 0.11,
    "regularMarketDayHigh": 256.13,
    "regularMarketDayLow": 250.65,
    "regularMarketVolume": 26686584,
    "averageDailyVolume3Month": 47781611,
    "regularMarketPreviousClose": 255.63,
    "fiftyTwoWeekHigh": 288.62,
    "fiftyTwoWeekLow": 169.21,
    "marketCap": 3761492983808,
    "trailingPE": 32.35,
    "marketState": "CLOSED",
    "preMarketPrice": null,
    "preMarketChange": null,
    "preMarketChangePercent": null,
    "postMarketPrice": 255.35,
    "postMarketChange": -0.57,
    "postMarketChangePercent": -0.22,
    "beta": 1.28,
    "dividendYield": 0.41,
    "epsTrailingTwelveMonths": 7.91,
    "epsForward": 9.32,
    "fiftyDayAverage": 260.36,
    "twoHundredDayAverage": 249.15,
    "fiftyDayAverageChangePercent": -1.71,
    "twoHundredDayAverageChangePercent": 2.72,
    "analystTargetPrice": 280.00,
    "recommendationKey": "buy",
    "numberOfAnalystRatings": 42
  }
]
```

**Technical indicator fields:**
| Field | Description |
|-------|-------------|
| `beta` | Volatility relative to the market (1.0 = same volatility) |
| `dividendYield` | Annual dividend yield as percentage |
| `epsTrailingTwelveMonths` | Trailing 12-month earnings per share |
| `epsForward` | Forward EPS estimate |
| `fiftyDayAverage` | 50-day moving average price |
| `twoHundredDayAverage` | 200-day moving average price |
| `fiftyDayAverageChangePercent` | Price change vs MA50 (%) |
| `twoHundredDayAverageChangePercent` | Price change vs MA200 (%) |
| `analystTargetPrice` | Mean analyst price target |
| `recommendationKey` | Analyst rating: `strongBuy`, `buy`, `hold`, `sell`, `strongSell` |
| `numberOfAnalystRatings` | Number of analysts covering the stock |

The `currency` field reflects the stock's native trading currency (e.g., `"USD"`, `"GBp"`, `"DKK"`, `"EUR"`).

#### `GET /api/search?q=:query`

Search for tickers by name or symbol. Returns up to 10 results, filtered to equities and ETFs.

```
GET /api/search?q=Apple
```

**Response:**

```json
[
  { "symbol": "AAPL", "name": "Apple Inc.", "exchange": "NMS", "type": "EQUITY" },
  { "symbol": "APLE", "name": "Apple Hospitality REIT, Inc.", "exchange": "NYQ", "type": "EQUITY" }
]
```

#### `GET /api/chart/:symbol?range=:range&interval=:interval`

Fetch OHLCV chart data for a symbol.

| Parameter | Values | Description |
|-----------|--------|-------------|
| `range` | `1d`, `5d`, `1mo`, `3mo`, `1y`, `5y` | Time range |
| `interval` | `5m`, `15m`, `1d`, `1wk`, `1mo` | Candle interval |

```
GET /api/chart/AAPL?range=1mo&interval=1d
```

**Response:** Array of OHLCV data points:

```json
[
  { "time": 1772548200, "open": 263.48, "high": 265.56, "low": 260.13, "close": 263.75, "volume": 38568900 }
]
```

The `time` field is a Unix timestamp in seconds, compatible with TradingView Lightweight Charts.

#### `GET /api/health`

Health check endpoint.

```json
{ "status": "ok" }
```

### Portfolio Management

#### `GET /api/portfolio`

Returns the full portfolio config.

#### `PUT /api/portfolio`

Overwrites the entire portfolio config. Expects a JSON body with `currency`, `tickers`, and `holdings` fields.

#### `POST /api/portfolio/ticker`

Add a ticker to the watchlist.

```json
{ "symbol": "NVDA" }
```

#### `DELETE /api/portfolio/ticker/:symbol`

Remove a ticker and its associated holding.

```
DELETE /api/portfolio/ticker/NVDA
```

#### `PUT /api/portfolio/holding`

Add or update a holding. Set `shares` and `avgPrice` to `0` to remove a holding.

```json
{ "symbol": "AAPL", "shares": 25, "avgPrice": 142.50 }
```

#### `GET /api/portfolio/pension`

Returns pension portfolio holdings.

```json
{
  "holdings": [
    { "symbol": "FXAIX", "shares": 100, "avgPrice": 180.00 }
  ]
}
```

#### `PUT /api/portfolio/pension/holding`

Add or update a pension holding.

```json
{ "symbol": "FXAIX", "shares": 50, "avgPrice": 190.00 }
```

#### `DELETE /api/portfolio/pension/ticker/:symbol`

Remove a ticker from the pension portfolio.

```
DELETE /api/portfolio/pension/ticker/FXAIX
```

All portfolio endpoints return the updated full config in the response.

### Currency

#### `GET /api/currency/rates`

Returns all exchange rates relative to USD, sourced from the Frankfurter API. Cached for 5 minutes.

```json
{
  "USD": 1,
  "DKK": 6.4835,
  "GBP": 0.75708,
  "GBp": 75.708,
  "EUR": 0.86768,
  "SEK": 9.5421,
  ...
}
```

Includes synthetic sub-unit rates: `GBp` (British pence = GBP x 100) and `ILA` (Israeli agorot = ILS x 100).

---

## Currency Handling

The application distinguishes between **native currency** and **display currency**:

| Context | Currency used | Example |
|---------|-------------|---------|
| Stock price on card | Native (from Yahoo Finance) | CNA.L shows GBP 2.19 |
| Day range, 52-week range | Native | Shown in the stock's trading currency |
| Currency badge on card | Native label | `USD`, `GBX` (for GBp), `DKK`, `EUR` |
| Holdings/Pension summary totals | Display (user's choice) | All holdings converted and summed |
| Value column in portfolio table | Display | Converted to chosen currency |
| P&L column in portfolio table | Display | Converted to chosen currency |
| Price column in portfolio table | Native | Shown in the stock's trading currency |

**Sub-unit currencies:** Yahoo Finance reports some stocks in sub-units (e.g., London Stock Exchange stocks in GBp = pence). The app automatically converts these to the major unit for display (GBp 218.50 becomes GBP 2.19) and handles the conversion correctly when aggregating into portfolio totals.

**Exchange rate conversion path:** `source currency -> USD -> display currency`, using rates from the Frankfurter API.

---

## Data Sources

| Data | Source | API Key | Rate Limit | Cache |
|------|--------|---------|-----------|-------|
| Stock quotes | [Yahoo Finance](https://finance.yahoo.com) via [`yahoo-finance2`](https://github.com/gadicc/node-yahoo-finance2) v3 | Not required | Unofficial; may throttle under heavy use | 10 sec per symbol |
| Ticker search | Yahoo Finance search API | Not required | Same as above | None |
| Chart data (OHLCV) | Yahoo Finance chart API | Not required | Same as above | None |
| Exchange rates | [Frankfurter API](https://frankfurter.dev/) | Not required | None documented | 5 min |

**Note:** Yahoo Finance is an unofficial data source. The `yahoo-finance2` library handles authentication (crumb/cookie) automatically. Under very heavy usage, Yahoo may rate-limit or temporarily block requests. The 10-second quote cache helps reduce request volume.

---

## Local Development

For development outside Docker, you need Node.js 22+ installed.

**Terminal 1 -- Backend proxy:**

```bash
cd proxy
npm install
node server.js
```

The proxy starts on `http://localhost:3000`. It will read/write `config/portfolio.json` relative to the `CONFIG_PATH` environment variable (defaults to `/data/portfolio.json`). For local dev, override it:

```bash
CONFIG_PATH=../config/portfolio.json node server.js
```

**Terminal 2 -- Angular frontend:**

```bash
cd frontend
npm install
npx ng serve --proxy-config proxy.conf.json
```

You will need to create `frontend/proxy.conf.json` to forward API calls to the Express proxy:

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false
  }
}
```

The Angular dev server starts on `http://localhost:4200` with hot reload.

---

## Troubleshooting

**Container exits immediately after starting**

Check the logs:

```bash
docker logs stockoverview-stockoverview-1
```

If you see `ENOENT` errors about `portfolio.json`, make sure you copied the example config:

```bash
cp config/portfolio.example.json config/portfolio.json
```

**Yahoo Finance rate limiting (HTTP 429)**

The proxy caches quotes for 10 seconds per symbol. If you still get 429 errors, increase `QUOTE_TTL` in `proxy/server.js`. Restarting the container also resets any temporary blocks.

**Quotes not updating**

The dashboard pauses auto-refresh when the browser tab is hidden (to save API calls). Switch back to the tab and it resumes within 30 seconds.

**Wrong currency shown for a stock**

The currency comes directly from Yahoo Finance. Some exchanges use sub-unit currencies (e.g., GBp for pence on the London Stock Exchange). The app handles GBp and ILA automatically. If you encounter another sub-unit currency, it can be added to the `normalizeCurrencyCode` and `adjustSubunit` methods in `frontend/src/app/services/currency.service.ts` and the rates endpoint in `proxy/server.js`.

**Port 8080 is already in use**

Change the port mapping in `docker-compose.yml`:

```yaml
ports:
  - "3080:80"  # Use port 3080 instead
```

**Docker build fails with dependency errors**

Try a clean rebuild:

```bash
docker compose build --no-cache
```
