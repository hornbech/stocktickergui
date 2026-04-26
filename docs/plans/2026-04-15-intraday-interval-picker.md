# Intraday Interval Picker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Add a secondary interval selector for 1D and 5D chart ranges, offering higher-resolution options (1m, 2m, 5m for 1D; 1m, 5m, 15m for 5D).

**Architecture:** Extend `ChartRange` with an optional `intervalOptions` array. When the active range has multiple interval options, render a secondary pill-row below the range buttons. The proxy's `VALID_INTERVALS` whitelist and Swagger docs are updated to include `1m` and `2m`.

**Note:** Yahoo Finance's minimum interval is `1m`. Sub-minute intervals (30s, 60s) are not available from the data source.

**Tech Stack:** Angular 17 (standalone components, signals), TypeScript, Node/Express proxy, yahoo-finance2.

---

### Task 1: Add interval options to the model

**Files:**
- Modify: `frontend/src/app/models/stock.model.ts`

**Step 1: Update `ChartRange` interface and `CHART_RANGES`**

Replace the existing `ChartRange` interface and `CHART_RANGES` constant with:

```typescript
export interface ChartRange {
  label: string;
  range: string;
  interval: string;
  intervalOptions?: { label: string; interval: string }[];
}

export const CHART_RANGES: ChartRange[] = [
  {
    label: '1D',
    range: '1d',
    interval: '5m',
    intervalOptions: [
      { label: '1m', interval: '1m' },
      { label: '2m', interval: '2m' },
      { label: '5m', interval: '5m' },
    ]
  },
  {
    label: '5D',
    range: '5d',
    interval: '15m',
    intervalOptions: [
      { label: '1m', interval: '1m' },
      { label: '5m', interval: '5m' },
      { label: '15m', interval: '15m' },
    ]
  },
  { label: '1M',  range: '1mo', interval: '1d' },
  { label: '3M',  range: '3mo', interval: '1d' },
  { label: '1Y',  range: '1y',  interval: '1wk' },
  { label: '5Y',  range: '5y',  interval: '1mo' },
];
```

**Step 2: Verify TypeScript compiles cleanly**

```bash
cd /home/jhh/projects/stocktickergui/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to this change).

**Step 3: Commit**

```bash
git add frontend/src/app/models/stock.model.ts
git commit -m "feat: add intervalOptions to ChartRange for intraday resolution picker"
```

---

### Task 2: Add interval selector UI to stock-chart component

**Files:**
- Modify: `frontend/src/app/components/stock-chart/stock-chart.component.ts`

**Step 1: Add `activeInterval` signal and computed helper**

In the class body, after `activeRange: ChartRange = CHART_RANGES[1];`, add:

```typescript
activeInterval = signal<string>(CHART_RANGES[0].interval);
```

And add a getter to get the current interval options:

```typescript
get intervalOptions() {
  return this.activeRange.intervalOptions ?? [];
}
```

**Step 2: Update `changeRange` to reset interval**

Replace the existing `changeRange` method:

```typescript
changeRange(range: ChartRange): void {
  this.activeRange = range;
  // Reset to the range's default interval
  this.activeInterval.set(range.interval);
  this.loadChart();
}
```

**Step 3: Add `changeInterval` method**

```typescript
changeInterval(interval: string): void {
  this.activeInterval.set(interval);
  this.loadChart();
}
```

**Step 4: Update `loadChart` to use `activeInterval`**

Replace the `getChart` call inside `loadChart`:

```typescript
this.stockService.getChart(this.symbol, this.activeRange.range, this.activeInterval())
```

(Was: `this.activeRange.interval`)

**Step 5: Update `createBaseChart` to use `activeInterval`**

Replace the `timeVisible` condition on line ~423:

```typescript
timeVisible: this.activeRange.range === '1d' || this.activeRange.range === '5d'
```

This line is already correct — no change needed here.

**Step 6: Add the interval picker to the template**

After the closing `</div>` of `.range-buttons`, insert this block inside `.chart-controls`:

```html
@if (intervalOptions.length > 0) {
  <div class="interval-buttons">
    @for (opt of intervalOptions; track opt.interval) {
      <button
        [class.active]="activeInterval() === opt.interval"
        (click)="changeInterval(opt.interval)">
        {{ opt.label }}
      </button>
    }
  </div>
}
```

**Step 7: Add styles for `.interval-buttons`**

Inside the `styles` array, after the `.range-buttons button.active` rule, add:

```css
.interval-buttons {
  display: flex;
  gap: 4px;
}
.interval-buttons button {
  padding: 4px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
}
.interval-buttons button:hover {
  background: var(--bg-card-hover);
  color: var(--text-secondary);
}
.interval-buttons button.active {
  background: var(--blue-bg);
  border-color: var(--blue);
  color: var(--blue);
}
```

Also add responsive styles inside the `@media (max-width: 768px)` block:

```css
.interval-buttons {
  width: 100%;
  justify-content: flex-start;
}
.interval-buttons button {
  padding: 5px 8px;
  font-size: 10px;
}
```

**Step 8: Fix the default active range**

The component initializes with `activeRange = CHART_RANGES[1]` (5D). Update `activeInterval` initialization to match:

```typescript
activeInterval = signal<string>(CHART_RANGES[1].interval); // '15m'
```

**Step 9: Verify TypeScript compiles cleanly**

```bash
cd /home/jhh/projects/stocktickergui/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

**Step 10: Commit**

```bash
git add frontend/src/app/components/stock-chart/stock-chart.component.ts
git commit -m "feat: add intraday interval picker to stock chart (1m/2m/5m for 1D, 1m/5m/15m for 5D)"
```

---

### Task 3: Update proxy validation and Swagger docs

**Files:**
- Modify: `proxy/server.js`

**Step 1: Add `1m` and `2m` to `VALID_INTERVALS`**

Find line ~93:
```javascript
const VALID_INTERVALS = ['5m', '15m', '1d', '1wk', '1mo'];
```

Replace with:
```javascript
const VALID_INTERVALS = ['1m', '2m', '5m', '15m', '1d', '1wk', '1mo'];
```

**Step 2: Add cache TTLs for new intervals**

The `CHART_TTL` object is keyed on `range`, not `interval`, so no TTL change is needed — `1d` already has a 60-second TTL, which is appropriate for 1m data.

**Step 3: Update the Swagger docs**

Find the line (~335) with:
```javascript
{ name: 'interval', in: 'query', required: false, description: 'Candle interval', schema: { type: 'string', enum: ['5m', '15m', '1d', '1wk', '1mo'], default: '1d' } }
```

Replace with:
```javascript
{ name: 'interval', in: 'query', required: false, description: 'Candle interval', schema: { type: 'string', enum: ['1m', '2m', '5m', '15m', '1d', '1wk', '1mo'], default: '1d' } }
```

**Step 4: Verify the proxy starts without errors**

```bash
cd /home/jhh/projects/stocktickergui/proxy
node --input-type=module --eval "import './server.js'" 2>&1 | head -5
```

Expected: starts without syntax errors (or the `Authentication disabled` log line).

**Step 5: Commit**

```bash
git add proxy/server.js
git commit -m "feat: allow 1m and 2m intervals in chart API validation"
```

---

### Task 4: Manual smoke test

**Steps:**

1. Start the dev stack (or confirm it's running):
   ```bash
   cd /home/jhh/projects/stocktickergui
   docker compose up -d
   # or: cd proxy && node server.js & cd ../frontend && npm start
   ```

2. Open the dashboard in a browser.

3. Open a stock chart.

4. Click **1D** — verify an interval row appears showing `1m | 2m | 5m` with `5m` active.

5. Click **1m** — verify chart reloads with more candles at 1-minute resolution.

6. Click **2m** — verify chart reloads at 2-minute resolution.

7. Click **5D** — verify interval row shows `1m | 5m | 15m` with `15m` active.

8. Click **1M**, **3M**, **1Y**, **5Y** — verify no interval row appears for daily+ ranges.

9. Verify mobile layout (DevTools responsive mode) — interval row wraps cleanly.

**Expected:** All ranges and intervals load without errors. Interval picker disappears for non-intraday ranges.
