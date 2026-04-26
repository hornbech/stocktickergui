# Design Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Fix accessibility gaps, interaction inconsistencies, and motion/semantic issues across all Angular components.

**Architecture:** All components are single-file Angular 19 standalone components with inline templates and styles. No test suite exists — verification is `ng build` (must pass with zero errors) plus visual browser check. Global token system lives in `frontend/src/styles.css`. All edits are within `frontend/src/app/components/`.

**Tech Stack:** Angular 19, TypeScript, bespoke CSS custom properties, no component library.

---

## Phase A — Accessibility

### Task 1: Global `:focus-visible` outline

**Files:**
- Modify: `frontend/src/styles.css`

**Step 1: Add focus-visible rule after the existing utility classes**

Find the `.fade-in` block (ends around line 84) and add after it:

```css
/* Focus visible — keyboard navigation outline */
:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}
```

**Step 2: Verify build passes**

```bash
cd frontend && ng build 2>&1 | tail -5
```
Expected: `Application bundle generation complete.`

**Step 3: Visual check**

Open the app and Tab through interactive elements. Every button, link, and input should show a blue outline when focused via keyboard, but not when clicked with a mouse.

**Step 4: Commit**

```bash
git add frontend/src/styles.css
git commit -m "fix: add global :focus-visible outline for keyboard navigation"
```

---

### Task 2: Dashboard view toggle — tab semantics

**Files:**
- Modify: `frontend/src/app/components/dashboard/dashboard.component.ts`

**Step 1: Add `role="tablist"` to the wrapper div and `role="tab"` + `aria-selected` to each button**

Find the `<div class="view-toggle">` block (around line 138). Replace all four buttons with:

```html
<div class="view-toggle" role="tablist" aria-label="Dashboard views">
  <button
    role="tab"
    [attr.aria-selected]="activeView() === 'overview'"
    [class.active]="activeView() === 'overview'"
    (click)="setActiveView('overview')">Overview</button>
  <button
    role="tab"
    [attr.aria-selected]="activeView() === 'watchlist'"
    [class.active]="activeView() === 'watchlist'"
    (click)="setActiveView('watchlist')">Watchlist</button>
  <button
    role="tab"
    [attr.aria-selected]="activeView() === 'holdings'"
    [class.active]="activeView() === 'holdings'"
    (click)="setActiveView('holdings')">Holdings</button>
  <button
    role="tab"
    [attr.aria-selected]="activeView() === 'pension'"
    [class.active]="activeView() === 'pension'"
    (click)="setActiveView('pension')">Pension</button>
</div>
```

**Step 2: Add `aria-live` to the "Updated" timestamp**

Find `<span class="last-updated">` (around line 49). Change to:

```html
<span class="last-updated" aria-live="polite" aria-atomic="true">Updated {{ lastUpdated() }}</span>
```

**Step 3: Verify build passes**

```bash
cd frontend && ng build 2>&1 | tail -5
```

**Step 4: Commit**

```bash
git add frontend/src/app/components/dashboard/dashboard.component.ts
git commit -m "fix: add tab semantics and aria-live to dashboard"
```

---

### Task 3: Stock-card collapsible sections — `aria-expanded`

**Files:**
- Modify: `frontend/src/app/components/stock-card/stock-card.component.ts`

**Step 1: Add `aria-expanded` and `aria-label` to indicators header**

Find `.indicators-header` div (around line 102). Replace with:

```html
<div class="indicators-header"
     (click)="toggleIndicators($event)"
     [attr.aria-expanded]="showIndicators"
     aria-label="Indicators"
     tabindex="0"
     (keydown.enter)="toggleIndicators($event)"
     (keydown.space)="toggleIndicators($event)">
```

**Step 2: Add `aria-expanded` and `aria-label` to holdings header**

Find `.holdings-header` div (around line 168). Replace with:

```html
<div class="holdings-header"
     (click)="toggleHoldings($event)"
     [attr.aria-expanded]="showHoldings"
     aria-label="Holdings"
     tabindex="0"
     (keydown.enter)="toggleHoldings($event)"
     (keydown.space)="toggleHoldings($event)">
```

**Step 3: Add hover style to collapsible headers in the component styles**

Find `.indicators-header` CSS rule (around line 442). Add:

```css
.indicators-header:hover,
.holdings-header:hover {
  background: var(--bg-card-hover);
  border-radius: var(--radius);
}
.indicators-header:focus-visible,
.holdings-header:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
  border-radius: var(--radius);
}
```

**Step 4: Add `aria-label` to the remove button**

Find `<button class="remove-btn"` (around line 46). Change to:

```html
<button class="remove-btn" (click)="remove($event)" aria-label="Remove {{ quote.symbol }}">
```

**Step 5: Verify build passes**

```bash
cd frontend && ng build 2>&1 | tail -5
```

**Step 6: Visual check**

Tab to an Indicators/Holdings header — it should be focusable, show a blue outline, and toggle on Enter/Space.

**Step 7: Commit**

```bash
git add frontend/src/app/components/stock-card/stock-card.component.ts
git commit -m "fix: add aria-expanded, keyboard support, and hover states to stock-card collapsibles"
```

---

### Task 4: Convert holdings-summary table to semantic `<table>`

**Files:**
- Modify: `frontend/src/app/components/holdings-summary/holdings-summary.component.ts`

**Context:** The summary table currently uses `div.summary-table` with CSS grid. It must become a real `<table>` with `<thead>`, `<tbody>`, `<th scope="col">`, and `<td>` elements. The CSS grid columns must be replaced with `table-layout: fixed` or percentage widths.

**Step 1: Find the summary table template**

Search for `summary-table` in the component. The structure will look like:

```html
<div class="summary-table">
  <div class="table-header">...</div>
  @for (...) { <div class="table-row">...</div> }
  <div class="table-footer">...</div>
</div>
```

**Step 2: Replace with semantic table**

Replace the entire `summary-table` div with:

```html
<table class="summary-table">
  <thead>
    <tr>
      <th scope="col">Ticker</th>
      <th scope="col">Price</th>
      <th scope="col">GAK</th>
      <th scope="col">Value</th>
      <th scope="col">P&amp;L</th>
      <th scope="col"></th><!-- actions column -->
      <th scope="col"></th><!-- links column -->
    </tr>
  </thead>
  <tbody>
    @for (item of holdingItems(); track item.entry.symbol) {
      <tr class="table-row" [class.selected]="...">
        <td>...</td>
        <!-- mirror the existing cell content, one <td> per column -->
      </tr>
    }
  </tbody>
  <tfoot>
    <tr class="table-footer">
      <td colspan="3">Total</td>
      <td>{{ ... }}</td>
      <td [class.positive]="..." [class.negative]="...">{{ ... }}</td>
      <td></td>
      <td></td>
    </tr>
  </tfoot>
</table>
```

**Step 3: Update the CSS**

Replace the `display: grid` rules on `.summary-table`, `.table-header`, `.table-row`, `.table-footer` with:

```css
.summary-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.summary-table th {
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
}
.summary-table td {
  padding: 8px;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
}
.summary-table tfoot td {
  font-weight: 600;
  border-top: 1px solid var(--border);
  border-bottom: none;
}
.summary-table tbody tr:hover {
  background: var(--bg-card-hover);
}
```

**Step 4: Verify build passes**

```bash
cd frontend && ng build 2>&1 | tail -5
```

**Step 5: Visual check**

Holdings table should look visually identical but now renders as a real HTML table.

**Step 6: Commit**

```bash
git add frontend/src/app/components/holdings-summary/holdings-summary.component.ts
git commit -m "fix: convert holdings-summary table from CSS grid to semantic <table>"
```

---

### Task 5: Convert pension-summary table to semantic `<table>`

**Files:**
- Modify: `frontend/src/app/components/pension-summary/pension-summary.component.ts`

**Steps:** Mirror Task 4 exactly — pension-summary is structurally identical to holdings-summary. Apply the same template and CSS changes.

**Verify build passes, visual check, then commit:**

```bash
git add frontend/src/app/components/pension-summary/pension-summary.component.ts
git commit -m "fix: convert pension-summary table from CSS grid to semantic <table>"
```

---

### Task 6: Convert portfolio-summary table to semantic `<table>`

**Files:**
- Modify: `frontend/src/app/components/portfolio-summary/portfolio-summary.component.ts`

**Steps:** Same approach as Task 4. The portfolio table has 4 or 6 columns depending on whether cost basis is shown. Use `colspan` or conditional `<th>`/`<td>` elements as needed.

**Verify build passes, visual check, then commit:**

```bash
git add frontend/src/app/components/portfolio-summary/portfolio-summary.component.ts
git commit -m "fix: convert portfolio-summary table from CSS grid to semantic <table>"
```

---

### Task 7: Fix search dropdown positioning in holdings-summary and pension-summary

**Files:**
- Modify: `frontend/src/app/components/holdings-summary/holdings-summary.component.ts`
- Modify: `frontend/src/app/components/pension-summary/pension-summary.component.ts`

**Context:** The search results dropdown uses `position: fixed` which detaches it from the layout and breaks when the page scrolls. It should use `position: absolute` anchored to its `position: relative` parent.

**Step 1: In holdings-summary, find the `.search-results` CSS rule**

Change:
```css
.search-results {
  position: fixed;
  ...
}
```
To:
```css
.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 200;
  ...
}
```

Also verify the parent `.search-input-group` has `position: relative` (it should already).

**Step 2: Apply the same change to pension-summary**

**Step 3: Verify build passes**

```bash
cd frontend && ng build 2>&1 | tail -5
```

**Step 4: Visual check**

Open Holdings, click "Add Position", type a ticker. The dropdown should appear directly below the input and stay aligned when scrolling.

**Step 5: Commit**

```bash
git add frontend/src/app/components/holdings-summary/holdings-summary.component.ts \
        frontend/src/app/components/pension-summary/pension-summary.component.ts
git commit -m "fix: change search dropdown from position:fixed to position:absolute"
```

---

## Phase B — Interaction Consistency

### Task 8: Standardize button hover effects

**Files:**
- Modify: `frontend/src/styles.css`

**Context:** Buttons currently use a mix of `opacity: 0.85`, `opacity: 0.9`, and color-swaps. Standardize to a single subtle brightness shift that works for all button variants.

**Step 1: Add to global styles after the `:focus-visible` rule**

```css
/* Standardized button hover — applies to all buttons unless component overrides */
button:hover:not(:disabled) {
  filter: brightness(1.1);
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Step 2: Audit each component for conflicting `opacity`-based hover rules**

Search for `opacity: 0.85` and `opacity: 0.9` in hover rules across all component files. Remove them — the global rule takes over. Keep color-swap hovers (e.g. remove-btn going red) as they are intentional.

```bash
grep -rn "opacity: 0.8\|opacity: 0.9" frontend/src/app/components/
```

Remove only the ones inside `:hover` pseudo-selectors.

**Step 3: Verify build passes and visually check all buttons**

```bash
cd frontend && ng build 2>&1 | tail -5
```

**Step 4: Commit**

```bash
git add frontend/src/styles.css frontend/src/app/components/
git commit -m "fix: standardize button hover effects across all components"
```

---

## Phase C — Motion & Semantics

### Task 9: Respect `prefers-reduced-motion`

**Files:**
- Modify: `frontend/src/app/components/news-ticker/news-ticker.component.ts`
- Modify: `frontend/src/styles.css`

**Step 1: In news-ticker component styles, add a media query after the `@keyframes scroll` block**

```css
@media (prefers-reduced-motion: reduce) {
  .ticker-content {
    animation: none;
    overflow-x: auto;
  }
}
```

**Step 2: In global `styles.css`, add after the `@keyframes fadeIn` block**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Step 3: Verify build passes**

```bash
cd frontend && ng build 2>&1 | tail -5
```

**Step 4: Visual check**

In Chrome DevTools → Rendering → Emulate CSS media: `prefers-reduced-motion: reduce`. The news ticker should stop scrolling, skeleton animations should freeze, and fade-ins should be instant.

**Step 5: Commit**

```bash
git add frontend/src/app/components/news-ticker/news-ticker.component.ts \
        frontend/src/styles.css
git commit -m "fix: respect prefers-reduced-motion for news ticker and global animations"
```

---

### Task 10: `aria-label` on icon-only buttons

**Files:**
- Modify: `frontend/src/app/components/dashboard/dashboard.component.ts`
- Modify: `frontend/src/app/components/stock-card/stock-card.component.ts` (already done in Task 3)

**Step 1: In dashboard, find the info-close button**

Add `aria-label="Close"`:
```html
<button class="info-close" (click)="showInfo = false" aria-label="Close about panel">
```

**Step 2: In dashboard, find the info-toggle button (the "i" icon in the header)**

Add `aria-label`:
```html
<button class="info-btn" (click)="showInfo = !showInfo" [attr.aria-expanded]="showInfo" aria-label="About this app">
```

**Step 3: Verify build passes**

```bash
cd frontend && ng build 2>&1 | tail -5
```

**Step 4: Commit**

```bash
git add frontend/src/app/components/dashboard/dashboard.component.ts
git commit -m "fix: add aria-labels to icon-only buttons in dashboard"
```

---

## Final Step: Push

```bash
git push
```

---

## Checklist

- [ ] Task 1 — Global `:focus-visible`
- [ ] Task 2 — Dashboard tab semantics + `aria-live`
- [ ] Task 3 — Stock-card collapsible `aria-expanded` + keyboard + hover
- [ ] Task 4 — Holdings-summary `<table>`
- [ ] Task 5 — Pension-summary `<table>`
- [ ] Task 6 — Portfolio-summary `<table>`
- [ ] Task 7 — Search dropdown `position: absolute`
- [ ] Task 8 — Standardize button hover
- [ ] Task 9 — `prefers-reduced-motion`
- [ ] Task 10 — `aria-label` on icon-only buttons
