import { Component, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';
import { StockService } from '../../services/stock.service';
import { PortfolioService } from '../../services/portfolio.service';
import { CurrencyService } from '../../services/currency.service';
import { StockQuote } from '../../models/stock.model';
import { TickerInputComponent } from '../ticker-input/ticker-input.component';
import { StockCardComponent } from '../stock-card/stock-card.component';
import { StockChartComponent } from '../stock-chart/stock-chart.component';
import { HoldingsSummaryComponent } from '../holdings-summary/holdings-summary.component';
import { PensionSummaryComponent } from '../pension-summary/pension-summary.component';
import { CurrencyToggleComponent } from '../currency-toggle/currency-toggle.component';
import { NewsTickerComponent } from '../news-ticker/news-ticker.component';
import { StatsService } from '../../services/stats.service';
import { AuthService } from '../../services/auth.service';
import { MarketHoursComponent } from '../market-hours/market-hours.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    TickerInputComponent,
    StockCardComponent,
    StockChartComponent,
    HoldingsSummaryComponent,
    PensionSummaryComponent,
    CurrencyToggleComponent,
    NewsTickerComponent,
    MarketHoursComponent
  ],
  template: `
    <header class="app-header">
      <div class="header-left">
        <button class="info-btn" (click)="showInfoPanel.set(!showInfoPanel())" title="About">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </button>
        <h1 class="app-title">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Stock Overview
        </h1>
        @if (lastUpdated()) {
          <span class="last-updated">Updated {{ lastUpdated() }}</span>
        }
      </div>
      <div class="header-right">
        <app-market-hours></app-market-hours>
        <app-currency-toggle></app-currency-toggle>
      </div>
    </header>

    @if (showInfoPanel()) {
      <div class="info-backdrop" (click)="showInfoPanel.set(false)"></div>
      <div class="info-panel fade-in">
        <div class="info-panel-header">
          <h3>About Stock Overview</h3>
          <button class="info-close" (click)="showInfoPanel.set(false)">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path fill="currentColor" d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.749.749 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.749.749 0 1 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
            </svg>
          </button>
        </div>
        <div class="info-content">
          <p class="info-description">A real-time stock ticker dashboard for tracking equities and ETFs across global markets.</p>

          <div class="info-section">
            <span class="info-label">Created by</span>
            <span>Jacob Hornbech</span>
          </div>
          <div class="info-section">
            <span class="info-label">Built with</span>
            <span>Angular 19, Express.js & Claude AI</span>
          </div>
          <div class="info-section">
            <span class="info-label">Server started</span>
            <span>{{ serverStartedAt() || '...' }}</span>
          </div>

          <div class="info-section">
            <span class="info-label">Total visitors</span>
            <span>{{ statsService.totalVisitors() | number }}</span>
          </div>
          <div class="info-section">
            <span class="info-label">Currently online</span>
            <span class="online-indicator">
              <span class="online-dot"></span>
              {{ statsService.onlineUsers() }}
            </span>
          </div>

          <div class="info-section">
            <span class="info-label">API</span>
            <p class="info-description">The backend exposes a REST API with endpoints for quotes, charts, search, news, and portfolio management. Full interactive documentation is available via Swagger UI.</p>
          </div>

          <div class="info-links">
            <a href="/api/docs/" target="_blank" rel="noopener noreferrer" class="info-link-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              API Documentation
            </a>
            <a href="https://github.com/hornbech/stocktickergui" target="_blank" rel="noopener noreferrer" class="info-link-btn">
              <svg viewBox="0 0 16 16" width="16" height="16">
                <path fill="currentColor" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
              </svg>
              View on GitHub
            </a>
          </div>

          @if (authService.authEnabled()) {
          <button class="logout-btn" (click)="onLogout()">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
          }

          <p class="info-footer">Open source — feature requests and merge requests welcome!</p>
        </div>
      </div>
    }

    <main class="main-content">
      <div class="view-toggle">
        <button
          [class.active]="activeView() === 'overview'"
          (click)="setActiveView('overview')">
          Overview
        </button>
        <button
          [class.active]="activeView() === 'watchlist'"
          (click)="setActiveView('watchlist')">
          Watchlist
        </button>
        <button
          [class.active]="activeView() === 'holdings'"
          (click)="setActiveView('holdings')">
          Holdings
        </button>
        <button
          [class.active]="activeView() === 'pension'"
          (click)="setActiveView('pension')">
          Pension
        </button>
      </div>

      @if (activeView() === 'overview') {
        <div class="overview-grid">
          <div class="overview-card holdings-overview">
            <div class="overview-header">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              <h3>Holdings</h3>
            </div>
            <div class="overview-value">
              {{ currencyService.formatDisplay(totalHoldingsValue()) }}
            </div>
            <div class="overview-pnl" [class.positive]="totalHoldingsPnL() >= 0" [class.negative]="totalHoldingsPnL() < 0">
              @if (totalHoldingsPnL() !== 0) {
                {{ totalHoldingsPnL() >= 0 ? '+' : '' }}{{ currencyService.formatDisplay(Math.abs(totalHoldingsPnL())) }}
                ({{ totalHoldingsPnLPct() >= 0 ? '+' : '' }}{{ totalHoldingsPnLPct().toFixed(2) }}%)
              } @else {
                No P&L data
              }
            </div>
          </div>

          <div class="overview-card pension-overview">
            <div class="overview-header">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/>
              </svg>
              <h3>Pension</h3>
            </div>
            <div class="overview-value">
              {{ currencyService.formatDisplay(totalPensionValue()) }}
            </div>
            <div class="overview-pnl" [class.positive]="totalPensionPnL() >= 0" [class.negative]="totalPensionPnL() < 0">
              @if (totalPensionPnL() !== 0) {
                {{ totalPensionPnL() >= 0 ? '+' : '' }}{{ currencyService.formatDisplay(Math.abs(totalPensionPnL())) }}
                ({{ totalPensionPnLPct() >= 0 ? '+' : '' }}{{ totalPensionPnLPct().toFixed(2) }}%)
              } @else {
                No P&L data
              }
            </div>
          </div>

          <div class="overview-card total-overview">
            <div class="overview-header">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              <h3>Total</h3>
            </div>
            <div class="overview-value total">
              {{ currencyService.formatDisplay(totalHoldingsValue() + totalPensionValue()) }}
            </div>
            <div class="overview-pnl" [class.positive]="(totalHoldingsPnL() + totalPensionPnL()) >= 0" [class.negative]="(totalHoldingsPnL() + totalPensionPnL()) < 0">
              @if ((totalHoldingsPnL() + totalPensionPnL()) !== 0) {
                {{ (totalHoldingsPnL() + totalPensionPnL()) >= 0 ? '+' : '' }}{{ currencyService.formatDisplay(Math.abs(totalHoldingsPnL() + totalPensionPnL())) }}
              } @else {
                —
              }
            </div>
          </div>
        </div>

        <app-news-ticker [symbols]="allSymbols()"></app-news-ticker>

        @if (overviewSymbols().length > 0) {
          <div class="overview-chart">
            <div class="chart-header">
              <h4>Portfolio Performance</h4>
              <div class="chart-symbols">
                @for (sym of overviewSymbols(); track sym) {
                  <button
                    class="chart-symbol-btn"
                    [class.active]="selectedOverviewSymbol() === sym"
                    (click)="selectedOverviewSymbol.set(sym)">
                    {{ sym }}
                  </button>
                }
              </div>
            </div>
            @if (selectedOverviewSymbol()) {
              <app-stock-chart [symbol]="selectedOverviewSymbol()"></app-stock-chart>
            }
          </div>
        }
      }

      @if (activeView() === 'watchlist') {
        <div class="watchlist-toolbar">
          <app-ticker-input (tickerAdded)="onTickerAdded($event)"></app-ticker-input>
          @if (watchlistQuotes().length > 0) {
            <span class="ticker-count">{{ watchlistQuotes().length }} watching</span>
          }
        </div>

        @if (loading() && watchlistQuotes().length === 0) {
          <div class="loading-grid">
            @for (i of [1,2,3]; track i) {
              <div class="skeleton-card">
                <div class="skeleton" style="width: 60%; height: 20px; margin-bottom: 12px;"></div>
                <div class="skeleton" style="width: 40%; height: 32px; margin-bottom: 16px;"></div>
                <div class="skeleton" style="width: 100%; height: 80px;"></div>
              </div>
            }
          </div>
        }

        @if (watchlistQuotes().length > 0) {
          <app-news-ticker [symbols]="portfolioService.tickers()"></app-news-ticker>
          <div class="cards-grid">
            @for (quote of watchlistQuotes(); track quote.symbol) {
              <app-stock-card
                [quote]="quote"
                [selected]="selectedSymbol() === quote.symbol"
                [showHoldingsSection]="false"
                (cardClicked)="selectSymbol($event)"
                (removed)="onTickerRemoved($event)">
              </app-stock-card>
            }
          </div>
        }

        @if (selectedSymbol() && activeView() === 'watchlist') {
          <app-stock-chart [symbol]="selectedSymbol()"></app-stock-chart>
        }

        @if (!loading() && watchlistQuotes().length === 0) {
          <div class="empty-state">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <h2>No tickers added</h2>
            <p>Search for a stock ticker above to get started</p>
          </div>
        }
      }

      @if (activeView() === 'holdings') {
        <app-holdings-summary [quotes]="quotes()" (portfolioChanged)="fetchAllQuotes()"></app-holdings-summary>
      }

      @if (activeView() === 'pension') {
        <app-pension-summary [quotes]="quotes()" (portfolioChanged)="fetchAllQuotes()"></app-pension-summary>
      }
    </main>
  `,
  styles: [`
    .app-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 32px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-light);
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(12px);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .app-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
    }
    .app-title svg {
      color: var(--blue);
    }
    .last-updated {
      font-size: 12px;
      color: var(--text-muted);
    }
    .info-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px;
      border-radius: var(--radius);
      display: flex;
      align-items: center;
      transition: all var(--transition);
    }
    .info-btn:hover {
      color: var(--blue);
      background: var(--blue-bg);
    }
    .info-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 100;
    }
    .info-panel {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: 340px;
      max-width: 90vw;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border);
      z-index: 101;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-lg);
    }
    .info-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-light);
    }
    .info-panel-header h3 {
      font-size: 15px;
      font-weight: 600;
      margin: 0;
    }
    .info-close {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
    }
    .info-close:hover {
      background: var(--red-bg);
      color: var(--red);
    }
    .info-content {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .info-description {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.6;
    }
    .info-section {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 13px;
    }
    .info-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-links {
      padding-top: 4px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .info-link-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text-primary);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: all var(--transition);
    }
    .info-link-btn:hover {
      border-color: var(--blue);
      color: var(--blue);
    }
    .online-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .online-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 6px var(--green);
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .logout-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text-secondary);
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition);
    }
    .logout-btn:hover {
      border-color: var(--red);
      color: var(--red);
      background: var(--red-bg);
    }
    .info-footer {
      font-size: 12px;
      color: var(--text-muted);
      font-style: italic;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .main-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: 24px 32px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .watchlist-toolbar {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .ticker-count {
      font-size: 13px;
      color: var(--text-muted);
      white-space: nowrap;
    }
    .view-toggle {
      display: flex;
      gap: 4px;
      padding: 4px;
      background: var(--bg-secondary);
      border-radius: var(--radius);
      width: fit-content;
    }
    .view-toggle button {
      padding: 8px 20px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border-radius: var(--radius);
      transition: all var(--transition);
    }
    .view-toggle button:hover {
      color: var(--text-primary);
    }
    .view-toggle button.active {
      background: var(--bg-card);
      color: var(--text-primary);
      box-shadow: var(--shadow);
    }
    .overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
    }
    .overview-card {
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg);
      padding: 20px;
    }
    .overview-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .overview-header svg {
      color: var(--blue);
    }
    .overview-header h3 {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
    }
    .overview-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 8px;
    }
    .overview-value.total {
      color: var(--blue);
    }
    .overview-pnl {
      font-size: 13px;
      color: var(--text-muted);
    }
    .overview-pnl.positive { color: var(--green); }
    .overview-pnl.negative { color: var(--red); }
    .overview-chart {
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg);
      padding: 20px;
    }
    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .chart-header h4 {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
    }
    .chart-symbols {
      display: flex;
      gap: 8px;
    }
    .chart-symbol-btn {
      padding: 4px 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text-secondary);
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }
    .chart-symbol-btn:hover {
      border-color: var(--blue);
    }
    .chart-symbol-btn.active {
      background: var(--blue-bg);
      border-color: var(--blue);
      color: var(--blue);
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 16px;
    }
    .loading-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 16px;
    }
    .skeleton-card {
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg);
      padding: 20px;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 20px;
      color: var(--text-muted);
      text-align: center;
      gap: 12px;
    }
    .empty-state h2 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-secondary);
    }
    .empty-state p {
      font-size: 14px;
    }
    @media (max-width: 768px) {
      .app-header {
        padding: 10px 12px;
        flex-direction: column;
        gap: 8px;
      }
      .header-left {
        gap: 8px;
      }
      .app-title {
        font-size: 15px;
        gap: 6px;
      }
      .app-title svg {
        width: 18px;
        height: 18px;
      }
      .last-updated {
        font-size: 11px;
      }
      .main-content {
        padding: 12px;
        gap: 16px;
      }
      .view-toggle {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .view-toggle::-webkit-scrollbar {
        display: none;
      }
      .view-toggle button {
        padding: 8px 16px;
        font-size: 12px;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .overview-grid {
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .overview-card {
        padding: 16px;
      }
      .overview-value {
        font-size: 22px;
      }
      .overview-pnl {
        font-size: 12px;
      }
      .overview-chart {
        padding: 12px;
      }
      .chart-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
      }
      .chart-symbols {
        flex-wrap: wrap;
        gap: 6px;
      }
      .cards-grid, .loading-grid {
        grid-template-columns: 1fr;
      }
      .watchlist-toolbar {
        flex-direction: column;
        align-items: stretch;
      }
      .empty-state {
        padding: 48px 16px;
      }
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  quotes = signal<Map<string, StockQuote>>(new Map());
  selectedSymbol = signal<string>('');
  selectedOverviewSymbol = signal<string>('');
  loading = signal(false);
  lastUpdated = signal<string>('');
  activeView = signal<'overview' | 'watchlist' | 'holdings' | 'pension'>('overview');
  showInfoPanel = signal(false);
  serverStartedAt = signal<string>('');
  Math = Math;

  watchlistQuotes = computed(() => {
    const tickers = this.portfolioService.tickers();
    const map = this.quotes();
    return tickers.map(s => map.get(s)).filter((q): q is StockQuote => !!q);
  });

  overviewSymbols = computed(() => {
    const holdings = this.portfolioService.entries();
    const pension = this.portfolioService.pensionEntries();
    const allSymbols = [...holdings, ...pension].map(e => e.symbol);
    return [...new Set(allSymbols)];
  });

  allSymbols = computed(() => {
    const watchlist = this.portfolioService.tickers();
    const holdings = this.portfolioService.entries().map(e => e.symbol);
    const pension = this.portfolioService.pensionEntries().map(e => e.symbol);
    return [...new Set([...watchlist, ...holdings, ...pension])];
  });

  totalHoldingsValue = computed(() => {
    const entries = this.portfolioService.entries();
    const map = this.quotes();
    return entries.reduce((sum, entry) => {
      const quote = map.get(entry.symbol);
      if (!quote) return sum;
      const value = entry.shares * quote.regularMarketPrice;
      return sum + this.currencyService.convertToDisplay(value, quote.currency);
    }, 0);
  });

  totalHoldingsPnL = computed(() => {
    const entries = this.portfolioService.entries();
    const map = this.quotes();
    return entries.reduce((sum, entry) => {
      const quote = map.get(entry.symbol);
      if (!quote || entry.avgPrice === 0) return sum;
      const value = entry.shares * quote.regularMarketPrice;
      const cost = entry.shares * entry.avgPrice;
      const pnl = value - cost;
      return sum + this.currencyService.convertToDisplay(pnl, quote.currency);
    }, 0);
  });

  totalHoldingsPnLPct = computed(() => {
    const entries = this.portfolioService.entries();
    const map = this.quotes();
    let totalCost = 0;
    let totalValue = 0;
    entries.forEach(entry => {
      const quote = map.get(entry.symbol);
      if (quote && entry.avgPrice > 0) {
        totalCost += entry.shares * entry.avgPrice;
        totalValue += entry.shares * quote.regularMarketPrice;
      }
    });
    if (totalCost === 0) return 0;
    return ((totalValue - totalCost) / totalCost) * 100;
  });

  totalPensionValue = computed(() => {
    const entries = this.portfolioService.pensionEntries();
    const map = this.quotes();
    return entries.reduce((sum, entry) => {
      const quote = map.get(entry.symbol);
      if (!quote) return sum;
      const value = entry.shares * quote.regularMarketPrice;
      return sum + this.currencyService.convertToDisplay(value, quote.currency);
    }, 0);
  });

  totalPensionPnL = computed(() => {
    const entries = this.portfolioService.pensionEntries();
    const map = this.quotes();
    return entries.reduce((sum, entry) => {
      const quote = map.get(entry.symbol);
      if (!quote || entry.avgPrice === 0) return sum;
      const value = entry.shares * quote.regularMarketPrice;
      const cost = entry.shares * entry.avgPrice;
      const pnl = value - cost;
      return sum + this.currencyService.convertToDisplay(pnl, quote.currency);
    }, 0);
  });

  totalPensionPnLPct = computed(() => {
    const entries = this.portfolioService.pensionEntries();
    const map = this.quotes();
    let totalCost = 0;
    let totalValue = 0;
    entries.forEach(entry => {
      const quote = map.get(entry.symbol);
      if (quote && entry.avgPrice > 0) {
        totalCost += entry.shares * entry.avgPrice;
        totalValue += entry.shares * quote.regularMarketPrice;
      }
    });
    if (totalCost === 0) return 0;
    return ((totalValue - totalCost) / totalCost) * 100;
  });

  setActiveView(view: 'overview' | 'watchlist' | 'holdings' | 'pension'): void {
    this.activeView.set(view);
    if (view === 'pension') {
      this.selectedSymbol.set('');
    }
    if (view === 'overview' && this.overviewSymbols().length > 0) {
      this.selectedOverviewSymbol.set(this.overviewSymbols()[0]);
    }
  }

  private refreshSub?: Subscription;
  private initialized = false;

  constructor(
    private stockService: StockService,
    public portfolioService: PortfolioService,
    public currencyService: CurrencyService,
    private http: HttpClient,
    public statsService: StatsService,
    public authService: AuthService
  ) {
    effect(() => {
      if (this.portfolioService.loaded() && !this.initialized) {
        this.initialized = true;
        this.currencyService.initCurrency(this.portfolioService.initialCurrency());
        this.fetchAllQuotes();
        if (this.overviewSymbols().length > 0 && !this.selectedOverviewSymbol()) {
          this.selectedOverviewSymbol.set(this.overviewSymbols()[0]);
        }
      }
    });
  }

  ngOnInit(): void {
    this.portfolioService.init();
    this.currencyService.fetchRates();
    this.refreshSub = interval(30000).subscribe(() => {
      if (document.visibilityState === 'visible') {
        this.fetchAllQuotes();
        this.currencyService.fetchRates();
      }
    });
    this.http.get<{ startedAt: string }>('/api/health').subscribe({
      next: (res) => {
        if (res.startedAt) {
          this.serverStartedAt.set(new Date(res.startedAt).toLocaleString());
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  onLogout(): void {
    this.authService.logout().subscribe(() => {
      this.showInfoPanel.set(false);
    });
  }

  onTickerAdded(symbol: string): void {
    this.portfolioService.addTicker(symbol);
    this.fetchAllQuotes();
    if (!this.selectedSymbol()) {
      this.selectedSymbol.set(symbol.toUpperCase());
    }
  }

  onTickerRemoved(symbol: string): void {
    this.portfolioService.removeTicker(symbol);
    const map = new Map(this.quotes());
    map.delete(symbol);
    this.quotes.set(map);
    if (this.selectedSymbol() === symbol) {
      const remaining = this.portfolioService.tickers();
      this.selectedSymbol.set(remaining.length > 0 ? remaining[0] : '');
    }
  }

  selectSymbol(symbol: string): void {
    this.selectedSymbol.set(symbol);
  }

  fetchAllQuotes(): void {
    const watchlist = this.portfolioService.tickers();
    const holdings = this.portfolioService.entries().map(e => e.symbol);
    const pension = this.portfolioService.pensionSymbols();
    const allSymbols = [...new Set([...watchlist, ...holdings, ...pension])];

    if (allSymbols.length === 0) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.stockService.getQuotes(allSymbols).subscribe({
      next: (quotes) => {
        const map = new Map<string, StockQuote>();
        for (const q of quotes) {
          map.set(q.symbol, q);
        }
        this.quotes.set(map);
        this.loading.set(false);
        this.lastUpdated.set(new Date().toLocaleTimeString());
      },
      error: (err) => {
        console.error('Failed to fetch quotes:', err);
        this.loading.set(false);
      }
    });
  }
}
