import { Component, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { StockService } from '../../services/stock.service';
import { PortfolioService } from '../../services/portfolio.service';
import { CurrencyService } from '../../services/currency.service';
import { StockQuote } from '../../models/stock.model';
import { TickerInputComponent } from '../ticker-input/ticker-input.component';
import { StockCardComponent } from '../stock-card/stock-card.component';
import { StockChartComponent } from '../stock-chart/stock-chart.component';
import { PortfolioSummaryComponent } from '../portfolio-summary/portfolio-summary.component';
import { PensionSummaryComponent } from '../pension-summary/pension-summary.component';
import { CurrencyToggleComponent } from '../currency-toggle/currency-toggle.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    TickerInputComponent,
    StockCardComponent,
    StockChartComponent,
    PortfolioSummaryComponent,
    PensionSummaryComponent,
    CurrencyToggleComponent
  ],
  template: `
    <header class="app-header">
      <div class="header-left">
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
        <app-currency-toggle></app-currency-toggle>
      </div>
    </header>

    <main class="main-content">
      <div class="toolbar">
        <app-ticker-input (tickerAdded)="onTickerAdded($event)"></app-ticker-input>
        @if (activeView() === 'watchlist' && quotes().size > 0) {
          <span class="ticker-count">{{ quotes().size }} watching</span>
        }
        @if (activeView() === 'holdings' && holdingsSymbols().length > 0) {
          <span class="ticker-count">{{ holdingsSymbols().length }} holding{{ holdingsSymbols().length !== 1 ? 's' : '' }}</span>
        }
      </div>

      @if (activeView() === 'watchlist' && portfolioService.entries().length > 0) {
        <app-portfolio-summary
          [entries]="portfolioService.entries()"
          [quotes]="quotes()">
        </app-portfolio-summary>
      }

      <div class="view-toggle">
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

      @if (selectedSymbol() && activeView() !== 'pension') {
        <app-stock-chart [symbol]="selectedSymbol()"></app-stock-chart>
      }

      @if (activeView() === 'pension') {
        <app-pension-summary [quotes]="quotes()"></app-pension-summary>
      } @else {
        @if (loading() && currentViewQuotes().length === 0) {
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

        @if (currentViewQuotes().length > 0) {
          <div class="cards-grid">
            @for (quote of currentViewQuotes(); track quote.symbol) {
              <app-stock-card
                [quote]="quote"
                [selected]="selectedSymbol() === quote.symbol"
                (cardClicked)="selectSymbol($event)"
                (removed)="onTickerRemoved($event)">
              </app-stock-card>
            }
          </div>
        }

        @if (!loading() && currentViewQuotes().length === 0) {
          <div class="empty-state">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <h2>No {{ activeView() === 'holdings' ? 'holdings' : 'tickers' }} added</h2>
            <p>{{ activeView() === 'holdings' ? 'Add holdings from your watchlist cards below' : 'Search for a stock ticker above to get started' }}</p>
          </div>
        }
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
    .toolbar {
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
        padding: 12px 16px;
        flex-direction: column;
        gap: 12px;
      }
      .main-content {
        padding: 16px;
      }
      .cards-grid {
        grid-template-columns: 1fr;
      }
      .toolbar {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  quotes = signal<Map<string, StockQuote>>(new Map());
  selectedSymbol = signal<string>('');
  loading = signal(false);
  lastUpdated = signal<string>('');
  activeView = signal<'watchlist' | 'holdings' | 'pension'>('watchlist');

  quotesArray = computed(() => {
    const symbols = this.portfolioService.symbols();
    const map = this.quotes();
    return symbols.map(s => map.get(s)).filter((q): q is StockQuote => !!q);
  });

  holdingsSymbols = computed(() => {
    return this.portfolioService.entries().map(e => e.symbol);
  });

  currentViewQuotes = computed(() => {
    const map = this.quotes();
    if (this.activeView() === 'watchlist') {
      return this.quotesArray();
    } else if (this.activeView() === 'holdings') {
      return this.holdingsSymbols().map(s => map.get(s)).filter((q): q is StockQuote => !!q);
    }
    return [];
  });

  setActiveView(view: 'watchlist' | 'holdings' | 'pension'): void {
    this.activeView.set(view);
    if (view === 'pension') {
      this.selectedSymbol.set('');
    }
  }

  private refreshSub?: Subscription;

  constructor(
    private stockService: StockService,
    public portfolioService: PortfolioService,
    private currencyService: CurrencyService
  ) {
    // When config loads from server, apply currency and fetch quotes
    effect(() => {
      if (this.portfolioService.loaded()) {
        this.currencyService.initCurrency(this.portfolioService.initialCurrency());
        this.fetchQuotes();
      }
    });
  }

  ngOnInit(): void {
    // Auto-refresh every 30 seconds
    this.refreshSub = interval(30000).subscribe(() => {
      if (document.visibilityState === 'visible') {
        this.fetchQuotes();
        this.currencyService.fetchRates();
      }
    });
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  onTickerAdded(symbol: string): void {
    this.portfolioService.addTicker(symbol);
    this.fetchQuotes();
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
      const remaining = this.portfolioService.symbols();
      this.selectedSymbol.set(remaining.length > 0 ? remaining[0] : '');
    }
  }

  selectSymbol(symbol: string): void {
    this.selectedSymbol.set(symbol);
  }

  private fetchQuotes(): void {
    const symbols = this.portfolioService.symbols();
    if (symbols.length === 0) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.stockService.getQuotes(symbols).subscribe({
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
