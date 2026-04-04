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
- Three-portfolio system: Watchlist, Holdings, Pension
- Multi-currency display (USD, DKK, EUR, GBP, SEK, NOK, CHF, CAD, AUD)
- Technical indicators on stock cards (Beta, Dividend Yield, EPS, MA50/MA200, Analyst Rating)
- File-based persistence via `config/portfolio.json`
- No API keys required

## Architecture

### Directory Structure

```
stocktickergui/
├── frontend/                    # Angular 19 SPA
│   └── src/app/
│       ├── components/          # Standalone Angular components
│       │   ├── dashboard/      # Main layout, tab management
│       │   ├── stock-card/     # Per-ticker card with indicators
│       │   ├── stock-chart/    # TradingView chart wrapper
│       │   ├── ticker-input/   # Search input with autocomplete
│       │   ├── portfolio-summary/    # Watchlist summary table
│       │   ├── holdings-summary/    # Holdings tab with search
│       │   ├── pension-summary/     # Pension tab with search
│       │   ├── currency-toggle/    # Currency dropdown
│       │   └── market-status/      # Market state badge
│       ├── services/
│       │   ├── stock.service.ts      # API calls to proxy
│       │   ├── portfolio.service.ts   # Portfolio CRUD
│       │   └── currency.service.ts    # Exchange rates, formatting
│       └── models/
│           ├── stock.model.ts        # StockQuote, SearchResult
│           └── portfolio.model.ts    # PortfolioEntry
├── proxy/
│   └── server.js              # Express proxy (ESM)
├── config/
│   └── portfolio.example.json # Example config with holdings
├── nginx.conf                 # nginx configuration
└── Dockerfile                 # Multi-stage Docker build
```

### Portfolio Config Structure

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

### Key Patterns

1. **State Management**: Angular signals (`signal()`, `computed()`, `effect()`)
2. **Components**: Standalone components (no NgModules)
3. **API Communication**: All frontend-backend via HTTP through nginx reverse proxy
4. **Persistence**: Backend reads/writes `config/portfolio.json` (volume-mounted)
5. **Currency Handling**: Native currency per stock, convert to display currency for totals

## Common Tasks

### Running Locally

```bash
# Build and run Docker
docker compose up --build

# Open http://localhost:8080
```

### Adding a New Stock Card Indicator

1. Backend: Add field to `mapQuote()` in `proxy/server.js`
2. Frontend model: Add field to `StockQuote` interface in `frontend/src/app/models/stock.model.ts`
3. UI: Add display in `stock-card.component.ts` template

### Adding a New Component

1. Create component in `frontend/src/app/components/[component-name]/`
2. Use standalone component pattern with imports array
3. Register in `dashboard.component.ts` imports

### API Endpoints

- `GET /api/health` - Health check
- `GET /api/quote/:symbols` - Get stock quotes with indicators
- `GET /api/search?q=` - Search tickers
- `GET /api/chart/:symbol` - Historical chart data
- `GET /api/currency/rates` - Exchange rates
- `GET/PUT /api/portfolio` - Full portfolio config
- `POST/DELETE /api/portfolio/ticker` - Add/remove tickers
- `PUT /api/portfolio/holding` - Update holdings
- `GET/PUT /api/portfolio/pension` - Pension portfolio
- `PUT /api/portfolio/pension/holding` - Update pension holdings

## Code Conventions

- **Naming**: kebab-case for files, PascalCase for components/classes
- **Styling**: CSS variables for theming (dark theme)
- **No comments**: Unless explaining complex logic
- **TypeScript**: Strict typing, no `any`
- **Angular**: Signals for state, standalone components, no NgModules

## Dependencies

- Frontend: Angular 19, TradingView Lightweight Charts
- Backend: Express, yahoo-finance2, swagger-ui-express
- External APIs: Yahoo Finance (quotes), Frankfurter (exchange rates)
