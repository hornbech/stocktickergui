# Day-2 Ops: Pino Logging + Renovate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Add pino structured JSON logging to the Express proxy and a Renovate config for automated dependency PRs.

**Architecture:** Pino is installed as a single dep in `proxy/`; a logger instance replaces all `console.*` calls and a request middleware logs every non-noisy HTTP request. Renovate config is a single JSON file in the repo root that the Renovate GitHub App reads.

**Tech Stack:** Node.js 22 ESM, Express 4, pino 9, Renovate JSON schema v2

---

### Task 1: Install pino and add request logging middleware

**Files:**
- Modify: `proxy/package.json`
- Modify: `proxy/server.js` (top of file and after `app.use(express.json(...))`)

**Step 1: Add pino to dependencies**

In `proxy/package.json`, add to the `dependencies` object:
```json
"pino": "^9.0.0"
```

The full dependencies block becomes:
```json
"dependencies": {
  "bcrypt": "^6.0.0",
  "express": "^4.21.0",
  "express-rate-limit": "^8.3.2",
  "express-session": "^1.19.0",
  "pino": "^9.0.0",
  "swagger-ui-express": "^5.0.0",
  "yahoo-finance2": "^3.14.0"
}
```

**Step 2: Install the dependency**

```bash
cd proxy && npm install
```

Expected: `added 1 package` (pino and its deps), no errors.

**Step 3: Add logger import and instance**

At the top of `proxy/server.js`, after the existing imports, add:

```js
import pino from 'pino';

const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino-pretty', options: { colorize: true } }
  })
});
```

Note: `pino-pretty` is bundled with pino v9 as an optional dep — no separate install needed.

**Step 4: Add request logging middleware**

After the line `app.use(express.json({ limit: '10kb' }));`, add:

```js
app.use((req, res, next) => {
  if (req.path === '/api/health' || req.path === '/api/stats/heartbeat') return next();
  const start = Date.now();
  res.on('finish', () => {
    log.info({ method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - start });
  });
  next();
});
```

**Step 5: Verify server starts and logs requests**

```bash
cd proxy && CONFIG_PATH=../config/portfolio.example.json node server.js &
curl -s http://localhost:3000/api/health
kill %1
```

Expected: server prints a JSON line like `{"level":30,"time":...,"method":"GET","path":"/api/health",...}` to stdout. (Health is excluded from request logs, but the startup log from step 6 will confirm pino is wired.)

**Step 6: Commit**

```bash
git add proxy/package.json proxy/package-lock.json proxy/server.js
git commit -m "feat: add pino logger and request logging middleware"
```

---

### Task 2: Replace console calls with structured log calls

**Files:**
- Modify: `proxy/server.js` (all `console.log`, `console.warn`, `console.error` calls)

Replace each `console.*` call as follows. Find them with:
```bash
grep -n "console\." proxy/server.js
```

**Replacements (line numbers are approximate — use the grep output):**

| Original | Replacement |
|----------|-------------|
| `console.error('Failed to read cache:', err.message)` | `log.error({ err: err.message }, 'Failed to read cache')` |
| `console.error('Failed to write cache:', err.message)` | `log.error({ err: err.message }, 'Failed to write cache')` |
| `console.log(\`Cache cleanup: purged ${purged} expired chart entries\`)` | `log.info({ purged }, 'Cache cleanup complete')` |
| `console.error('Cache cleanup error:', err.message)` | `log.error({ err: err.message }, 'Cache cleanup error')` |
| `console.error('FATAL: DASHBOARD_PASSWORD must be at least 8 characters')` | `log.fatal('DASHBOARD_PASSWORD must be at least 8 characters')` |
| `console.log('Authentication enabled — login required')` | `log.info('Authentication enabled')` |
| `console.log(\`Authentication bypass enabled for host: ${AUTH_BYPASS_HOST}\`)` | `log.info({ host: AUTH_BYPASS_HOST }, 'Auth bypass enabled')` |
| `console.log('Authentication disabled — no DASHBOARD_PASSWORD set')` | `log.info('Authentication disabled')` |
| `console.warn(\`Failed login attempt #${failedAttempts}\`)` | `log.warn({ attempt: failedAttempts }, 'Failed login attempt')` |
| `console.error('Failed to read stats:', err.message)` | `log.error({ err: err.message }, 'Failed to read stats')` |
| `console.error('Failed to write stats:', err.message)` | `log.error({ err: err.message }, 'Failed to write stats')` |
| `console.error('Quote error:', err.message)` | `log.error({ err: err.message }, 'Quote fetch failed')` |
| `console.error('Search error:', err.message)` | `log.error({ err: err.message }, 'Search failed')` |
| `console.error('Chart error:', err.message)` | `log.error({ err: err.message }, 'Chart fetch failed')` |
| `console.error(\`News fetch error for ${symbol}:\`, err.message)` | `log.error({ symbol, err: err.message }, 'News fetch failed')` |
| `console.error('News error:', err.message)` | `log.error({ err: err.message }, 'News error')` |
| `console.error('Currency error:', err.message)` | `log.error({ err: err.message }, 'Currency fetch failed')` |
| `console.error('Failed to read config:', err.message)` | `log.error({ err: err.message }, 'Failed to read config')` |
| `console.error('Failed to write config:', err.message)` | `log.error({ err: err.message }, 'Failed to write config')` |
| `console.log(\`Proxy server running on http://127.0.0.1:${PORT}\`)` | `log.info({ port: PORT }, 'Proxy server started')` |

**Also add context to the quote and chart error handlers** (find the `catch` blocks in those routes):

Quote route catch block — change to:
```js
} catch (err) {
  log.error({ symbols, err: err.message }, 'Quote fetch failed');
  res.status(500).json({ error: 'Failed to fetch quotes' });
}
```

Chart route catch block — change to:
```js
} catch (err) {
  log.error({ symbol, range, interval, err: err.message }, 'Chart fetch failed');
  res.status(500).json({ error: 'Failed to fetch chart data' });
}
```

Search route catch block — change to:
```js
} catch (err) {
  log.error({ query, err: err.message }, 'Search failed');
  res.status(500).json({ error: 'Search failed' });
}
```

**Step: Verify no console calls remain**

```bash
grep -n "console\." proxy/server.js
```

Expected: no output.

**Step: Smoke-test the server**

```bash
cd proxy && CONFIG_PATH=../config/portfolio.example.json node server.js &
curl -s http://localhost:3000/api/currency/rates | head -c 100
curl -s http://localhost:3000/api/health
kill %1
```

Expected: server starts with `{"level":30,...,"msg":"Proxy server started"}`, requests produce log lines, no crash.

**Step: Commit**

```bash
git add proxy/server.js
git commit -m "feat: replace console calls with structured pino logging"
```

---

### Task 3: Add Renovate config

**Files:**
- Create: `renovate.json`

**Step 1: Create `renovate.json` in the repo root**

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "schedule": ["every monday"],
  "labels": ["dependencies"],
  "packageRules": [
    {
      "description": "Group frontend minor and patch updates",
      "matchFileNames": ["frontend/package.json"],
      "matchUpdateTypes": ["minor", "patch"],
      "groupName": "frontend dependencies (minor/patch)",
      "automerge": false
    },
    {
      "description": "Group proxy minor and patch updates",
      "matchFileNames": ["proxy/package.json"],
      "matchUpdateTypes": ["minor", "patch"],
      "groupName": "proxy dependencies (minor/patch)",
      "automerge": false
    },
    {
      "description": "yahoo-finance2 always gets its own PR",
      "matchPackageNames": ["yahoo-finance2"],
      "groupName": null,
      "addLabels": ["yahoo-finance"],
      "automerge": false
    }
  ]
}
```

**Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('renovate.json','utf8')); console.log('valid')"
```

Expected: `valid`

**Step 3: Commit**

```bash
git add renovate.json
git commit -m "chore: add Renovate config for weekly dependency updates"
```

---

### Task 4: Manual step — install Renovate GitHub App

This task is performed by the user, not automated.

1. Go to `https://github.com/apps/renovate`
2. Click **Install**
3. Select the `stocktickergui` repository
4. Renovate will open an onboarding PR within minutes — merge it to activate

That's it. From then on, every Monday Renovate creates grouped PRs for minor/patch updates and individual PRs for majors and `yahoo-finance2`.

---

## Verification Checklist

After all tasks:

- [ ] `grep -n "console\." proxy/server.js` returns no output
- [ ] `node -e "JSON.parse(require('fs').readFileSync('renovate.json','utf8')); console.log('valid')"` prints `valid`
- [ ] `docker compose up --build` starts cleanly; `docker logs` shows JSON log lines
- [ ] Renovate GitHub App is installed and onboarding PR is open
