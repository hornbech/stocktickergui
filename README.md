# Stock Overview Dashboard

A real-time stock ticker dashboard built with Angular 19, Express.js proxy, and Docker.

## Features

- **Add/remove stock tickers** with search autocomplete
- **GAV/GAK portfolio tracking** — enter your average purchase price and shares held
- **USD/DKK currency toggle** with live exchange rates
- **Pre-market & after-hours** data display
- **Interactive charts** with TradingView Lightweight Charts (1D, 5D, 1M, 3M, 1Y, 5Y)
- **Auto-refresh** every 30 seconds during market hours
- **Dark theme** with responsive layout
- Data persisted in browser localStorage

## Quick Start

```bash
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080)

That's it. No NPM, Node, or any other dependency needed on your machine — just Docker.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────────┐
│   Browser    │────▶│    nginx     │────▶│  Express Proxy    │
│  (Angular)   │◀────│  (port 80)  │◀────│  (port 3000)      │
└─────────────┘     └──────────────┘     └───────────────────┘
                                                   │
                                          ┌────────┴────────┐
                                          │  Yahoo Finance  │
                                          │  Frankfurter FX │
                                          └─────────────────┘
```

- **Angular SPA** — built at Docker build time, served as static files by nginx
- **Express.js proxy** — fetches stock data from Yahoo Finance and currency rates from Frankfurter API
- **nginx** — serves the frontend and reverse-proxies `/api/*` to the Express backend
- All three run inside a single Docker container

## Data Sources

- **Stock data**: Yahoo Finance (via `yahoo-finance2` npm package) — no API key required
- **Currency rates**: [Frankfurter API](https://frankfurter.dev/) — free, no API key required

## Development

If you want to develop locally outside Docker:

```bash
# Terminal 1: proxy
cd proxy && npm install && node server.js

# Terminal 2: frontend (requires Node.js and Angular CLI)
cd frontend && npm install && npx ng serve --proxy-config proxy.conf.json
```

## Configuration

- **Port**: Change the port mapping in `docker-compose.yml` (default: 8080)
- **Refresh interval**: Hardcoded to 30 seconds in `dashboard.component.ts`
- **Quote cache TTL**: 10 seconds, configurable in `proxy/server.js`
