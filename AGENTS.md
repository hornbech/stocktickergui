# Stock Overview Dashboard - Agent README

This document provides context for AI agents working on this codebase.

## Project Overview

A real-time stock ticker dashboard for tracking equities and ETFs across global markets. Built with Angular 19, Express.js backend, and Docker.

**Stack:**
- Frontend: Angular 19 (standalone components, signals)
- Backend: Express.js (ESM module, proxy server)
- Infrastructure: Docker + nginx

**Key Features:**
- Real-time stock quotes from Yahoo Finance (30s auto-refresh)
- Interactive candlestick charts (TradingView Lightweight Charts)
- Four-tab system: Overview, Watchlist, Holdings, Pension
- Technical indicators: EMA, SMA, Bollinger Bands, RSI, MACD, Volume
- News ticker with scrolling headlines from Yahoo Finance RSS
- Multi-currency display (USD, DKK, EUR, GBP, SEK, NOK, CHF, CAD, AUD)
- File-based persistence via `config/portfolio.json`
- No API keys required

## Architecture

### Directory Structure

```
stocktickergui/
├── frontend/                    # Angular 19 SPA
│   └── src/app/
│       ├── components/        # Standalone Angular components
│       │   ├── dashboard/     # Main layout, tab management
│       │   ├── stock-card/    # Per-ticker card: price, stats
│       │   ├── stock-chart/   # TradingView charts with indicators
│       │   ├── ticker-input/  # Search input with autocomplete
│       │   ├── holdings-summary/   # Holdings: cards, chart, table, news
│       │   ├── pension-summary/    # Pension: cards, chart, table, news
│       │   ├── currency-toggle/    # Currency dropdown
│       │   ├── market-status/      # Market state badge
│       │   └── news-ticker/        # Scrolling news feed from Yahoo RSS
│       ├── services/
│       │   ├── stock.service.ts      # API calls to proxy
│       │   ├── portfolio.service.ts  # Portfolio CRUD
│       │   └── currency.service.ts   # Exchange rates, formatting
│       └── models/
│           ├── stock.model.ts        # StockQuote, ChartDataPoint, SearchResult, NewsItem
│           └── portfolio.model.ts    # PortfolioEntry
├── proxy/
│   └── server.js              # Express proxy (ESM)
├── config/
│   └── portfolio.example.json # Example config
├── nginx.conf                 # nginx configuration
├── Dockerfile                 # Multi-stage Docker build
└── docker-compose.yml         # Docker Compose config
```

### Portfolio Config Structure

The config uses a nested `portfolios` structure:

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

**Important:** Backend reads from `portfolios.default` for watchlist/holdings and `portfolios.pension` for pension portfolio.

### Dashboard Tabs

Each tab has a consistent layout pattern:

1. **Overview** - Portfolio summary showing Holdings + Pension totals, P&L, combined value, chart selector, news ticker
2. **Watchlist** - Track stocks with search/add functionality, stock cards, chart, news ticker
3. **Holdings** - Stock cards at top, interactive chart when symbol selected, detailed P&L table, news ticker
4. **Pension** - Same layout as Holdings: stock cards, chart, table, news ticker

**Layout Pattern for Holdings/Pension:**
```
┌─────────────────────────────────────────────────┐
│ [NEWS TICKER - scrolling headlines]             │
├─────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│ │ CARD 1 │ │ CARD 2 │ │ CARD 3 │           │
│ └─────────┘ └─────────┘ └─────────┘           │
├─────────────────────────────────────────────────┤
│ [CHART - shown when symbol selected]            │
├─────────────────────────────────────────────────┤
│ Ticker │ Price │ Shares │ Value │ P&L │ Actions │
│ AAPL   │ $178  │ 50     │ $8.9k │ +$ │ [x]    │
│ MSFT   │ $415  │ 25     │ $10.3k│ -$ │ [x]    │
│ Total  │       │        │ $19.3k │ +$ │        │
└─────────────────────────────────────────────────┘
```

### Chart Indicators

The `stock-chart` component supports toggleable indicators:

**Main Chart Overlay:**
- EMA(20) - cyan
- SMA(50) - orange
- SMA(200) - purple
- Bollinger Bands (20, 2σ) - purple

**Sub-panels:**
- RSI(14) with overbought (>70) / oversold (<30) levels
- MACD(12,26,9) with histogram
- Volume with 20-day MA

All indicators are calculated client-side from OHLCV data.

### News Ticker

The `news-ticker` component displays a scrolling news feed:
- Appears at top of Overview, Watchlist, Holdings, and Pension tabs
- Fetches news from Yahoo Finance RSS feeds for all watched symbols
- Auto-scrolling animation with pause on hover
- Shows ticker symbol badges, headline, and source
- Auto-refreshes every 60 seconds
- Duplicate detection by GUID for deduplication
- Always visible (shows "Loading..." or "No news available" if empty)

### Key Patterns

1. **State Management**: Angular signals (`signal()`, `computed()`, `effect()`)
2. **Components**: Standalone components (no NgModules)
3. **API Communication**: All frontend-backend via HTTP through nginx reverse proxy
4. **Persistence**: Backend reads/writes `config/portfolio.json` (volume-mounted)
5. **Currency Handling**: Native currency per stock, convert to display currency for totals
6. **News Feed**: Yahoo Finance RSS feeds parsed and displayed in auto-scrolling ticker

## Common Tasks

### Running Locally

```bash
# Build and run Docker
docker compose up --build

# Open http://localhost:8080
```

### Adding a New Stock Card Field

1. Backend: Add field to `mapQuote()` in `proxy/server.js`
2. Frontend model: Add field to `StockQuote` interface in `models/stock.model.ts`
3. UI: Add display in `stock-card.component.ts` template

### Adding a New Chart Indicator

1. Add toggle button to `indicatorList` in `stock-chart.component.ts`
2. Add signal for indicator state in `indicators` signal object
3. Implement calculation method (e.g., `calculateEMA()`, `calculateRSI()`)
4. Add series rendering in `renderCharts()` or sub-panel method
5. Update template with new button

### Adding a New Component

1. Create component in `frontend/src/app/components/[component-name]/`
2. Use standalone component pattern with imports array
3. Register in `dashboard.component.ts` imports

### Adding News Ticker to a New Tab

1. Import `NewsTickerComponent` in the parent component
2. Add to imports array
3. Add `<app-news-ticker [symbols]="yourSymbols"></app-news-ticker>` to template

## API Endpoints

### Stock Data
- `GET /api/health` - Health check
- `GET /api/quote/:symbols` - Get stock quotes with indicators
- `GET /api/search?q=` - Search tickers
- `GET /api/chart/:symbol` - Historical chart data (OHLCV)
- `GET /api/news?symbols=AAPL,MSFT&limit=20` - News from Yahoo Finance RSS feeds

### Portfolio
- `GET /api/portfolio` - Get full portfolio config
- `PUT /api/portfolio` - Replace portfolio config
- `POST /api/portfolio/ticker` - Add ticker to watchlist
- `DELETE /api/portfolio/ticker/:symbol` - Remove ticker
- `PUT /api/portfolio/holding` - Update holding
- `GET /api/portfolio/pension` - Get pension holdings
- `PUT /api/portfolio/pension/holding` - Update pension holding
- `DELETE /api/portfolio/pension/ticker/:symbol` - Remove pension ticker

### Currency
- `GET /api/currency/rates` - Exchange rates

## Code Conventions

- **Naming**: kebab-case for files, PascalCase for components/classes
- **Styling**: CSS variables for theming (dark theme), inline in component
- **No comments**: Unless explaining complex logic
- **TypeScript**: Strict typing preferred, avoid `any`
- **Angular**: Signals for state, standalone components, no NgModules
- **State updates**: Use signals with `set()` or `update()`, not direct mutation

## Data Models

### StockQuote
```typescript
interface StockQuote {
  symbol: string;
  shortName: string;
  currency: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  // ... price/volume stats
  beta: number | null;
  dividendYield: number | null;
  epsTrailingTwelveMonths: number | null;
  epsForward: number | null;
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  analystTargetPrice: number | null;
  recommendationKey: string | null;
}
```

### NewsItem
```typescript
interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  guid: string;
  symbols?: string[];
}
```

### PortfolioEntry
```typescript
interface PortfolioEntry {
  symbol: string;
  shares: number;
  avgPrice: number;
}
```

### ChartDataPoint
```typescript
interface ChartDataPoint {
  time: number;  // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

## Dependencies

**Frontend:**
- Angular 19
- TradingView Lightweight Charts 4.2

**Backend:**
- Express.js
- yahoo-finance2 v3
- swagger-ui-express

**External APIs:**
- Yahoo Finance (quotes, search, charts, news RSS) - no API key
- Frankfurter API (exchange rates) - no API key

## Troubleshooting

**Build fails:**
```bash
docker compose build --no-cache
```

**Container won't start:**
```bash
docker logs stockoverview-stockoverview-1
# Check for missing portfolio.json
cp config/portfolio.example.json config/portfolio.json
```

**Yahoo rate limiting (429):**
- Increase `QUOTE_TTL` in `proxy/server.js`
- Restart container to reset blocks

**Frontend not updating:**
- Clear browser cache or use incognito mode
- Check browser console for errors

**News ticker not showing:**
- Check browser console for errors
- Verify symbols are added to watchlist/holdings/pension
- News API fetches from Yahoo Finance RSS - may fail if Yahoo is down
