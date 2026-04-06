# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Optional password authentication** -- protect the dashboard when exposing it to the internet without a reverse proxy:
  - Enable by setting `DASHBOARD_PASSWORD` environment variable (min 8 characters)
  - bcrypt-hashed at startup (cost factor 12), plaintext wiped from process.env
  - Server-side sessions via `express-session` with httpOnly, sameSite strict cookies
  - Brute force protection: login rate limiter (10 attempts / 15 min) + exponential lockout after 3 failures
  - Session fixation protection via `session.regenerate()` on login
  - Auth wall middleware blocks all API routes when unauthenticated
  - Angular login page with password field, error display, and loading state
  - Sign out button in info panel (only visible when auth is enabled)
  - Fully backwards compatible: no password set = no auth, app works as before
  - Optional `SESSION_SECRET` env var for session persistence across restarts

### Security
- **Rate limiting** -- added `express-rate-limit` with 120 req/min on all API routes and 30 req/min on write endpoints (portfolio, holdings, pension)
- **Input validation** -- all symbol parameters validated against `^[A-Z0-9.\-^=]{1,20}$` regex; chart range and interval validated against allowlists
- **Symbol count cap** -- max 50 symbols per request on quote and news endpoints to prevent amplification attacks
- **Generic error responses** -- all API error handlers now return generic messages instead of leaking internal paths and stack traces
- **Trust proxy hardened** -- changed `trust proxy` from `true` (trust all) to `'loopback'` (only trust nginx on localhost)
- **Body size limit** -- set `express.json({ limit: '10kb' })` to prevent oversized payloads
- **Session ID hardened** -- validated sessionId (string, max 64 chars) and capped `onlineUsers` Map at 10,000 entries to prevent memory exhaustion
- **Prototype pollution prevention** -- strip `__proto__`, `constructor`, `prototype` keys from portfolio PUT body; reject arrays
- **News limit capped** -- `?limit` parameter capped at 100
- **Subresource Integrity (SRI)** -- added `integrity` and `crossorigin="anonymous"` attributes to the Lightweight Charts CDN script tag
- **Cryptographic session IDs** -- replaced `Math.random()` with `crypto.getRandomValues()` for session ID generation
- **Security headers** -- nginx now sends `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`
- **Write endpoint rate limiting** -- portfolio mutation endpoints use a stricter 30 req/min limiter

### Fixed
- **Chart indicators broken when toggling** -- EMA, SMA, Bollinger Bands, RSI, MACD, and Volume indicators now correctly toggle on and off:
  - Fixed `@ViewChild` using `static: true` on conditionally rendered elements (`@if` blocks), causing refs to always be undefined
  - Fixed `updateCharts()` passing empty data arrays to render methods
  - Store chart data for re-rendering when indicators are toggled
  - Full chart re-render on toggle (via `setTimeout(0)`) ensures Angular has updated the DOM before accessing elements
  - Fixed ResizeObserver leak (new observer created on every render without disconnecting the old one)
- **`readPensionHoldings` crash** -- fixed undefined function call on DELETE pension endpoint (should be `getPensionHoldings`)

## [2.0.0] - 2026-04-06

### Added
- **Live market hours in header bar** -- NASDAQ and Copenhagen exchange status displayed as compact pills in the top bar:
  - Shows open/closed state with green/grey indicator dot
  - Dynamic countdown: time remaining until close (when open) or time until next open (when closed)
  - Displays current local time at each exchange with timezone abbreviation
  - Timezone-aware using `Intl.DateTimeFormat` -- works correctly regardless of client timezone
  - Handles weekends automatically (skips Saturday/Sunday when calculating next open)
  - Updates every 30 seconds
  - Responsive: hides countdown text on mobile, shows just name + dot + time
- **Info panel** -- slide-out panel accessible from the header with:
  - About section with creator info and tech stack
  - Server uptime display
  - Live visitor counter and online users indicator with pulsing green dot
  - GitHub repository link
- **Social links on stock cards** -- Yahoo Finance, StockTwits, and Reddit links for quick external research
- **Responsive mobile layout** -- the dashboard now auto-detects phone screens (viewport <= 768px) and adapts the entire UI:
  - Compact header with stacked title and currency selector
  - Horizontally scrollable tab bar
  - Single-column stock cards and overview summary cards
  - Holdings and Pension tables switch from 7-column grid to 2-column card layout with the header row hidden
  - Shorter chart heights (main: 250px, sub-panels: 80px)
  - Compact news ticker with smaller text
  - 16px input font size to prevent iOS Safari auto-zoom
  - Currency exchange rate hidden on small screens to save space
- **JSON file cache for chart data and currency rates** -- persists to `config/cache.json` across container restarts:
  - Chart data cached with range-dependent TTLs (1min for 1D, 5min for 5D, 1hr for 1M/3M, 24hr for 1Y/5Y)
  - Currency rates cached to disk with 5-minute TTL, providing a warm fallback on cold starts
  - Three-tier currency fallback: in-memory -> disk cache (even if expired) -> hardcoded defaults
  - Hourly automatic cleanup of expired chart cache entries
  - Zero new dependencies (uses existing `fs` module)
- **Visitor tracking** with session-based heartbeat and persistent stats in `config/stats.json`
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
