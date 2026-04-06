# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Responsive mobile layout** -- the dashboard now auto-detects phone screens (viewport <= 768px) and adapts the entire UI:
  - Compact header with stacked title and currency selector
  - Horizontally scrollable tab bar
  - Single-column stock cards and overview summary cards
  - Holdings and Pension tables switch from 7-column grid to 2-column card layout with the header row hidden
  - Shorter chart heights (main: 250px, sub-panels: 80px)
  - Compact news ticker with smaller text
  - 16px input font size to prevent iOS Safari auto-zoom
  - Currency exchange rate hidden on small screens to save space
- **Live market hours in header bar** -- NASDAQ and Copenhagen exchange status displayed as compact pills in the top bar:
  - Shows open/closed state with green/grey indicator dot
  - Dynamic countdown: time remaining until close (when open) or time until next open (when closed)
  - Displays current local time at each exchange with timezone abbreviation
  - Timezone-aware using `Intl.DateTimeFormat` -- works correctly regardless of client timezone
  - Handles weekends automatically (skips Saturday/Sunday when calculating next open)
  - Updates every 30 seconds
  - Responsive: hides countdown text on mobile, shows just name + dot + time
- **JSON file cache for chart data and currency rates** -- persists to `config/cache.json` across container restarts:
  - Chart data cached with range-dependent TTLs (1min for 1D, 5min for 5D, 1hr for 1M/3M, 24hr for 1Y/5Y)
  - Currency rates cached to disk with 5-minute TTL, providing a warm fallback on cold starts
  - Three-tier currency fallback: in-memory -> disk cache (even if expired) -> hardcoded defaults
  - Hourly automatic cleanup of expired chart cache entries
  - Zero new dependencies (uses existing `fs` module)
- **Mobile Support section** in README documentation
- **Creator attribution and open source notice** in README
- **CHANGELOG.md** to track project changes

### Removed
- `.vscode/` directory from version control (already in `.gitignore`)

## [1.0.0] - 2026-04-04

### Added
- Four-tab dashboard: Overview, Watchlist, Holdings, Pension
- Real-time stock quotes with 30-second auto-refresh
- Interactive candlestick charts with TradingView Lightweight Charts
- Technical indicators: EMA(20), SMA(50), SMA(200), Bollinger Bands, RSI(14), MACD(12,26,9), Volume
- Scrolling news ticker from Yahoo Finance RSS feeds
- Ticker search with autocomplete
- Multi-currency display (USD, DKK, EUR, GBP, SEK, NOK, CHF, CAD, AUD)
- Portfolio management with GAK/GAV tracking and inline editing
- Separate pension portfolio tracking
- Overview tab with combined Holdings + Pension totals
- File-based persistence via `config/portfolio.json`
- Swagger API documentation at `/api/docs/`
- Docker + nginx deployment
