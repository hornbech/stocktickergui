import { Component, Input, Output, EventEmitter, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockQuote, SearchResult } from '../../models/stock.model';
import { PortfolioEntry } from '../../models/portfolio.model';
import { PortfolioService } from '../../services/portfolio.service';
import { CurrencyService } from '../../services/currency.service';
import { StockService } from '../../services/stock.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { StockCardComponent } from '../stock-card/stock-card.component';
import { StockChartComponent } from '../stock-chart/stock-chart.component';
import { NewsTickerComponent } from '../news-ticker/news-ticker.component';

interface PensionItem {
  entry: PortfolioEntry;
  quote?: StockQuote;
}

@Component({
  selector: 'app-pension-summary',
  standalone: true,
  imports: [CommonModule, FormsModule, StockCardComponent, StockChartComponent, NewsTickerComponent],
  template: `
    <div class="pension-summary">
      <div class="summary-header">
        <div class="header-left">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/>
            <path d="M2 9.5c1 0 2-.5 2-2s-1-2-2-2-2 .5-2 2 1 2 2 2z"/>
            <path d="M7 13h.01M12 13h.01"/>
          </svg>
          <h3>Pension Portfolio</h3>
        </div>
        <div class="header-actions">
          <button class="add-btn" (click)="toggleAddForm()">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path fill="currentColor" d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z"/>
            </svg>
            Add Fund
          </button>
        </div>
      </div>

      @if (showAddForm) {
        <div class="add-form fade-in">
          <div class="search-input-group">
            <svg class="search-icon" viewBox="0 0 16 16" width="14" height="14">
              <path fill="currentColor" d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 1 1-1.06 1.06l-3.04-3.04ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"/>
            </svg>
            <input 
              type="text" 
              [(ngModel)]="newSymbol" 
              (ngModelChange)="onSearch($event)"
              (keyup.enter)="addPensionFund()"
              (focus)="showSearchResults = true"
              placeholder="Search ticker or fund name..."
              class="search-input">
            @if (showSearchResults && searchResults.length > 0) {
              <div class="search-results">
                @for (r of searchResults; track r.symbol) {
                  <button class="result-item" (mousedown)="selectSearchResult(r)">
                    <span class="result-symbol">{{ r.symbol }}</span>
                    <span class="result-name">{{ r.name }}</span>
                  </button>
                }
              </div>
            }
          </div>
          <input 
            type="number" 
            [(ngModel)]="newShares" 
            placeholder="Shares"
            min="0" 
            step="0.001">
          <input 
            type="number" 
            [(ngModel)]="newAvgPrice" 
            placeholder="Avg Price"
            min="0" 
            step="0.01">
          <button (click)="addPensionFund()" [disabled]="!newSymbol">Add</button>
          <button class="cancel-btn" (click)="toggleAddForm()">Cancel</button>
        </div>
      }

      @if (pensionItems().length > 0) {
        <app-news-ticker [symbols]="pensionSymbols()"></app-news-ticker>
        <div class="cards-grid">
          @for (item of pensionItems(); track item.entry.symbol) {
            @if (item.quote) {
              <app-stock-card
                [quote]="item.quote"
                [selected]="selectedSymbol() === item.entry.symbol"
                [showHoldingsSection]="false"
                (cardClicked)="onSymbolSelected($event)"
                (removed)="removePension($event)">
              </app-stock-card>
            }
          }
        </div>

        @if (selectedSymbol() && selectedQuote()) {
          <app-stock-chart [symbol]="selectedSymbol()"></app-stock-chart>
        }

        <div class="summary-table">
          <div class="table-header">
            <span>Ticker</span>
            <span>Price</span>
            <span>Shares</span>
            <span>GAK</span>
            <span>Value</span>
            <span>P&L</span>
            <span></span>
          </div>
          @for (item of pensionItems(); track item.entry.symbol) {
            <div class="table-row" [class.selected]="selectedSymbol() === item.entry.symbol" (click)="onSymbolSelected(item.entry.symbol)">
              <span class="ticker">
                <span class="symbol">{{ item.entry.symbol }}</span>
                @if (item.quote) {
                  <span class="currency">{{ currencyService.currencyLabel(item.quote.currency) }}</span>
                }
                <a class="yahoo-link" [href]="'https://finance.yahoo.com/quote/' + item.entry.symbol" target="_blank" rel="noopener noreferrer" (click)="$event.stopPropagation()" title="View on Yahoo Finance">
                  <svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="11" fill="#7B1FA2"/><text x="12" y="16.5" text-anchor="middle" font-size="13" font-weight="700" fill="white" font-family="Arial,sans-serif">Y</text></svg>
                </a>
              </span>
              <span>{{ item.quote ? currencyService.formatNative(item.quote.regularMarketPrice, item.quote?.currency || 'USD') : '—' }}</span>
              <span class="editable-cell">
                <input type="number"
                  [value]="item.entry.shares"
                  (click)="$event.stopPropagation()"
                  (change)="onSharesChange(item.entry.symbol, $event)"
                  min="0" step="1">
              </span>
              <span class="editable-cell">
                <input type="number"
                  [value]="item.entry.avgPrice"
                  (click)="$event.stopPropagation()"
                  (change)="onAvgPriceChange(item.entry.symbol, $event)"
                  min="0" step="0.01">
              </span>
              <span>{{ currencyService.formatConverted(pensionItemValue(item), item.quote?.currency || 'USD') }}</span>
              <span [class.positive]="pensionPnL(item) >= 0" [class.negative]="pensionPnL(item) < 0">
                @if (item.entry.avgPrice > 0) {
                  {{ pensionPnL(item) >= 0 ? '+' : '' }}{{ currencyService.formatConverted(Math.abs(pensionPnL(item)), item.quote?.currency || 'USD') }}
                  ({{ pensionPnLPercent(item) >= 0 ? '+' : '' }}{{ pensionPnLPercent(item).toFixed(2) }}%)
                } @else {
                  —
                }
              </span>
              <span class="actions">
                <button class="remove-btn" (click)="removePension(item.entry.symbol)" title="Remove">
                  <svg viewBox="0 0 16 16" width="12" height="12">
                    <path fill="currentColor" d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.749.749 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.749.749 0 1 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
                  </svg>
                </button>
              </span>
            </div>
          }
          <div class="table-footer">
            <span>Total</span>
            <span></span>
            <span></span>
            <span></span>
            <span>{{ currencyService.formatDisplay(totalPensionValue()) }}</span>
            <span [class.positive]="totalPensionPnL() >= 0" [class.negative]="totalPensionPnL() < 0">
              @if (totalPensionPnL() !== 0) {
                {{ totalPensionPnL() >= 0 ? '+' : '' }}{{ currencyService.formatDisplay(Math.abs(totalPensionPnL())) }}
              }
            </span>
            <span></span>
          </div>
        </div>
      } @else if (!showAddForm) {
        <div class="empty-state">
          <p>No pension funds added yet. Click "Add Fund" to track your pension investments.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .pension-summary {
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .summary-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-light);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-left svg {
      color: var(--blue);
    }
    .header-left h3 {
      font-size: 14px;
      font-weight: 600;
      margin: 0;
    }
    .add-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--blue);
      border: none;
      border-radius: var(--radius);
      color: white;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition);
    }
    .add-btn:hover {
      opacity: 0.9;
    }
    .add-form {
      display: flex;
      gap: 8px;
      padding: 16px 20px;
      background: var(--bg-input);
      border-bottom: 1px solid var(--border-light);
      flex-wrap: wrap;
    }
    .add-form input {
      flex: 1;
      min-width: 120px;
      padding: 8px 12px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text-primary);
      font-family: inherit;
      font-size: 13px;
    }
    .add-form input:focus {
      outline: none;
      border-color: var(--blue);
    }
    .add-form input[type="number"] {
      max-width: 100px;
    }
    .add-form button {
      padding: 8px 16px;
      background: var(--green);
      border: none;
      border-radius: var(--radius);
      color: white;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .add-form button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .cancel-btn {
      background: var(--bg-secondary) !important;
      color: var(--text-secondary) !important;
      border: 1px solid var(--border) !important;
    }
    .search-input-group {
      flex: 1;
      min-width: 200px;
      position: relative;
      z-index: 100;
    }
    .search-input-group .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
    }
    .search-input-group .search-input {
      width: 100%;
      padding-left: 32px;
    }
    .search-results {
      position: fixed;
      min-width: 250px;
      max-width: 300px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-lg);
      z-index: 1000;
      max-height: 250px;
      overflow-y: auto;
    }
    .search-results .result-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: transparent;
      color: var(--text-primary);
      font-family: inherit;
      font-size: 13px;
      cursor: pointer;
      text-align: left;
    }
    .search-results .result-item:hover {
      background: var(--bg-card-hover);
    }
    .search-results .result-symbol {
      font-weight: 600;
      color: var(--blue);
      min-width: 60px;
    }
    .search-results .result-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
      padding: 16px 20px;
    }
    .summary-table {
      font-size: 13px;
    }
    .table-header, .table-row, .table-footer {
      display: grid;
      grid-template-columns: 1.5fr 1fr 0.8fr 0.8fr 1fr 1.2fr 50px;
      gap: 12px;
      padding: 12px 20px;
      align-items: center;
    }
    .table-header {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--border-light);
    }
    .table-row {
      border-bottom: 1px solid var(--border-light);
      cursor: pointer;
    }
    .table-row:hover {
      background: var(--bg-card-hover);
    }
    .table-row.selected {
      background: var(--blue-bg);
    }
    .table-row:last-of-type {
      border-bottom: none;
    }
    .table-footer {
      font-weight: 600;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-light);
    }
    .ticker {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ticker .symbol {
      font-weight: 600;
    }
    .ticker .currency {
      font-size: 10px;
      padding: 2px 4px;
      background: var(--bg-secondary);
      border-radius: 4px;
      color: var(--text-muted);
    }
    .yahoo-link {
      display: flex;
      align-items: center;
      opacity: 0.4;
      transition: opacity var(--transition);
    }
    .yahoo-link:hover {
      opacity: 1;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
    .remove-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
    }
    .remove-btn:hover {
      background: var(--red-bg);
      color: var(--red);
    }
    .editable-cell input {
      width: 80px;
      padding: 4px 6px;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text-primary);
      font-family: inherit;
      font-size: 12px;
      text-align: right;
    }
    .editable-cell input:focus {
      outline: none;
      border-color: var(--blue);
    }
    .positive { color: var(--green); }
    .negative { color: var(--red); }
    .empty-state {
      padding: 32px 20px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }
    .fade-in {
      animation: fadeIn 0.2s ease-in;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 768px) {
      .summary-header {
        padding: 12px 14px;
      }
      .add-form {
        padding: 12px 14px;
        flex-direction: column;
      }
      .add-form input[type="number"] {
        max-width: none;
      }
      .add-form button {
        width: 100%;
      }
      .cards-grid {
        grid-template-columns: 1fr;
        padding: 12px 14px;
      }
      .table-header {
        display: none;
      }
      .table-row, .table-footer {
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 12px 14px;
      }
      .table-row {
        position: relative;
        padding-right: 36px;
      }
      .table-row .ticker {
        grid-column: 1 / -1;
        font-size: 14px;
      }
      .table-row .editable-cell input {
        width: 100%;
      }
      .table-row .actions {
        position: absolute;
        top: 12px;
        right: 10px;
      }
      .table-footer {
        grid-template-columns: 1fr 1fr;
      }
      .table-footer span:nth-child(2),
      .table-footer span:nth-child(3),
      .table-footer span:nth-child(4),
      .table-footer span:nth-child(7) {
        display: none;
      }
    }
  `]
})
export class PensionSummaryComponent implements OnInit {
  @Input() quotes: Map<string, StockQuote> = new Map();
  @Output() portfolioChanged = new EventEmitter<void>();

  showAddForm = false;
  newSymbol = '';
  newShares = 0;
  newAvgPrice = 0;
  searchResults: SearchResult[] = [];
  showSearchResults = false;
  Math = Math;
  private searchSubject = new Subject<string>();

  selectedSymbol = signal<string>('');

  selectedQuote = computed((): StockQuote | undefined => {
    const sym = this.selectedSymbol();
    return sym ? this.quotes.get(sym) : undefined;
  });

  pensionSymbols = computed((): string[] => {
    return this.portfolioService.pensionEntries().map(e => e.symbol);
  });

  pensionItems = computed((): PensionItem[] => {
    return this.portfolioService.pensionEntries().map(entry => ({
      entry,
      quote: this.quotes.get(entry.symbol)
    }));
  });

  constructor(
    public currencyService: CurrencyService,
    private portfolioService: PortfolioService,
    private stockService: StockService
  ) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => q.length >= 1 ? this.stockService.search(q) : of([]))
    ).subscribe(results => {
      this.searchResults = results;
      this.showSearchResults = results.length > 0;
    });
  }

  ngOnInit(): void {}

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.resetForm();
    }
  }

  onSearch(value: string): void {
    this.searchSubject.next(value);
  }

  onSymbolSelected(symbol: string): void {
    if (this.selectedSymbol() === symbol) {
      this.selectedSymbol.set('');
    } else {
      this.selectedSymbol.set(symbol);
    }
  }

  selectSearchResult(result: SearchResult): void {
    this.newSymbol = result.symbol;
    this.searchResults = [];
    this.showSearchResults = false;
  }

  resetForm(): void {
    this.newSymbol = '';
    this.newShares = 0;
    this.newAvgPrice = 0;
    this.searchResults = [];
    this.showSearchResults = false;
  }

  addPensionFund(): void {
    if (!this.newSymbol) return;

    const upper = this.newSymbol.toUpperCase();
    this.portfolioService.updatePensionHolding(upper, this.newShares, this.newAvgPrice);
    this.resetForm();
    this.showAddForm = false;
    this.portfolioChanged.emit();
  }

  onSharesChange(symbol: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const shares = parseFloat(input.value) || 0;
    const entry = this.portfolioService.getPensionEntry(symbol);
    this.portfolioService.updatePensionHolding(symbol, shares, entry?.avgPrice || 0);
  }

  onAvgPriceChange(symbol: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const avgPrice = parseFloat(input.value) || 0;
    const entry = this.portfolioService.getPensionEntry(symbol);
    this.portfolioService.updatePensionHolding(symbol, entry?.shares || 0, avgPrice);
  }

  removePension(symbol: string): void {
    this.portfolioService.removePensionTicker(symbol);
    this.portfolioChanged.emit();
  }

  pensionItemValue(item: PensionItem): number {
    if (!item.quote) return 0;
    return item.entry.shares * item.quote.regularMarketPrice;
  }

  pensionPnL(item: PensionItem): number {
    if (!item.quote || item.entry.avgPrice === 0) return 0;
    const nativeValue = item.entry.shares * item.quote.regularMarketPrice;
    const nativeCost = item.entry.shares * item.entry.avgPrice;
    return nativeValue - nativeCost;
  }

  pensionPnLPercent(item: PensionItem): number {
    if (!item.quote || item.entry.avgPrice === 0) return 0;
    return ((item.quote.regularMarketPrice - item.entry.avgPrice) / item.entry.avgPrice) * 100;
  }

  totalPensionValue(): number {
    return this.pensionItems().reduce((sum, item) => {
      return sum + this.currencyService.convertToDisplay(this.pensionItemValue(item), item.quote?.currency || 'USD');
    }, 0);
  }

  totalPensionPnL(): number {
    return this.pensionItems().reduce((sum, item) => {
      if (!item.quote) return sum;
      const nativeCost = item.entry.shares * item.entry.avgPrice;
      if (nativeCost === 0) return sum;
      const nativeValue = this.pensionItemValue(item);
      const nativePnL = nativeValue - nativeCost;
      return sum + this.currencyService.convertToDisplay(nativePnL, item.quote.currency);
    }, 0);
  }
}
