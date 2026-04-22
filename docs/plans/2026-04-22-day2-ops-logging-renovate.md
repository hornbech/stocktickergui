# Day-2 Ops: Structured Logging + Renovate

**Date:** 2026-04-22  
**Scope:** Proxy structured logging (pino) + Renovate dependency automation

---

## Problem

Two highest-value day-2 operations gaps:

1. **No structured logging** — `proxy/server.js` uses scattered `console.log/error` with no timestamps, no request tracing, no structured fields. Diagnosing Yahoo Finance 429s or upstream outages requires guesswork.
2. **No dependency automation** — `yahoo-finance2`, Angular, and base Docker images drift silently. `yahoo-finance2` in particular is an unofficial scraper that has broken across major versions.

---

## Design

### 1. Structured Logging (pino)

**Dependency:** Add `pino` to `proxy/package.json`.

**Logger setup:**
- Single `pino` logger instance at top of `server.js`
- JSON output in production (Docker default); pretty-print when `NODE_ENV=development`
- Log level: `info` by default, configurable via `LOG_LEVEL` env var

**Request middleware:**
- Runs after each response via `res.on('finish', ...)`
- Logs `{method, path, status, durationMs}` at `info` level
- Excludes `/api/health`, `/api/stats/heartbeat` (too noisy for health/heartbeat polling)

**Error log upgrades** (replace bare `console.error` calls):
- Quote errors: `log.error({ symbol, err: err.message }, 'Quote fetch failed')`
- Chart errors: `log.error({ symbol, range, interval, err: err.message }, 'Chart fetch failed')`
- Search errors: `log.error({ query, err: err.message }, 'Search failed')`
- News errors: `log.error({ symbol, err: err.message }, 'News fetch failed')`
- Currency errors: `log.error({ err: err.message }, 'Currency fetch failed')`
- Startup/config/cache messages stay as `log.info`

**Result:** `docker logs <container> | jq 'select(.level >= 40)'` shows all warnings and errors with context. `docker logs <container> | jq 'select(.path == "/api/quote")'` shows quote request history.

---

### 2. Renovate

**File:** `renovate.json` in repo root.

**Coverage:**
- `frontend/package.json` — Angular + TradingView Lightweight Charts
- `proxy/package.json` — Express, yahoo-finance2, pino (after this PR), swagger-ui-express

**Schedule:** Weekly, Mondays (avoids surprise mid-week breakage)

**Grouping strategy:**
- Minor + patch updates per directory → one grouped PR each (frontend, proxy)
- Major updates → individual PRs per package
- `yahoo-finance2` → always individual PR, labelled `yahoo-finance` (highest breakage risk)

**Auto-merge:** Disabled (manual review for all updates — this is a personal dashboard, prefer explicit)

**Installation required after merge:** Install the free Renovate GitHub App at `github.com/apps/renovate` and grant access to this repo.

---

## Files Changed

| File | Change |
|------|--------|
| `proxy/package.json` | Add `pino` dependency |
| `proxy/server.js` | Add logger, request middleware, replace console calls |
| `renovate.json` | New file — Renovate config |

---

## Out of Scope

- Portfolio backup (separate initiative)
- Health endpoint upstream validation (separate initiative)
- Docker image digest pinning (can be follow-up Renovate feature)
