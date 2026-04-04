import { Component, Input, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockQuote } from '../../models/stock.model';
import { PortfolioEntry } from '../../models/portfolio.model';
import { PortfolioService } from '../../services/portfolio.service';
import { CurrencyService } from '../../services/currency.service';
import { StockService } from '../../services/stock.service';

interface PensionItem {
  entry: PortfolioEntry;
  quote?: StockQuote;
}

@Component({
  selector: 'app-pension-summary',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
          <button class="add-btn" (click)="showAddForm = !showAddForm">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path fill="currentColor" d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z"/>
            </svg>
            Add Fund
          </button>
        </div>
      </div>

      @if (showAddForm) {
        <div class="add-form fade-in">
          <input 
            type="text" 
            [(ngModel)]="newSymbol" 
            placeholder="Ticker (e.g., FXAIX, VTSAX)"
            (keyup.enter)="addPensionFund()">
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
        </div>
      }

      @if (pensionItems().length > 0) {
        <div class="summary-table">
          <div class="table-header">
            <span>Ticker</span>
            <span>Price</span>
            <span>Shares</span>
            <span>Value</span>
            <span>P&L</span>
            <span></span>
          </div>
          @for (item of pensionItems(); track item.entry.symbol) {
            <div class="table-row">
              <span class="ticker">
                <span class="symbol">{{ item.entry.symbol }}</span>
                @if (item.quote) {
                  <span class="currency">{{ currencyService.currencyLabel(item.quote.currency) }}</span>
                }
              </span>
              <span>{{ item.quote ? currencyService.formatNative(item.quote.regularMarketPrice, item.quote?.currency || 'USD') : '—' }}</span>
              <span>{{ item.entry.shares }}</span>
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
            <span>{{ currencyService.formatConverted(totalPensionValue(), 'USD') }}</span>
            <span [class.positive]="totalPensionPnL() >= 0" [class.negative]="totalPensionPnL() < 0">
              @if (totalPensionPnL() !== 0) {
                {{ totalPensionPnL() >= 0 ? '+' : '' }}{{ currencyService.formatConverted(Math.abs(totalPensionPnL()), 'USD') }}
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
    }
    .add-form input {
      flex: 1;
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
    .summary-table {
      font-size: 13px;
    }
    .table-header, .table-row, .table-footer {
      display: grid;
      grid-template-columns: 1.5fr 1fr 0.8fr 1fr 1.2fr 50px;
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
  `]
})
export class PensionSummaryComponent implements OnInit {
  @Input() quotes: Map<string, StockQuote> = new Map();

  showAddForm = false;
  newSymbol = '';
  newShares = 0;
  newAvgPrice = 0;
  Math = Math;

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
  ) {}

  ngOnInit(): void {
    this.loadPensionQuotes();
  }

  private loadPensionQuotes(): void {
    const symbols = this.portfolioService.pensionSymbols();
    if (symbols.length === 0) return;

    this.stockService.getQuotes(symbols).subscribe(quotes => {
      for (const q of quotes) {
        this.quotes.set(q.symbol, q);
      }
    });
  }

  addPensionFund(): void {
    if (!this.newSymbol) return;

    const upper = this.newSymbol.toUpperCase();
    this.portfolioService.updatePensionHolding(upper, this.newShares, this.newAvgPrice);

    this.stockService.getQuotes([upper]).subscribe(quotes => {
      for (const q of quotes) {
        this.quotes.set(q.symbol, q);
      }
    });

    this.newSymbol = '';
    this.newShares = 0;
    this.newAvgPrice = 0;
    this.showAddForm = false;
  }

  removePension(symbol: string): void {
    this.portfolioService.removePensionTicker(symbol);
    this.quotes.delete(symbol.toUpperCase());
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
