import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StockQuote } from '../../models/stock.model';
import { PortfolioEntry } from '../../models/portfolio.model';
import { CurrencyService } from '../../services/currency.service';

@Component({
  selector: 'app-portfolio-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (entriesWithQuotes.length > 0) {
      <div class="summary-card">
        <h3 class="summary-title">Portfolio Summary</h3>
        <div class="summary-stats">
          <div class="stat-block">
            <span class="stat-label">Current Value ({{ currencyService.displayCurrency() }})</span>
            <span class="stat-value">{{ formatDisplayCurrency(totalValue) }}</span>
          </div>
          @if (hasCostBasis) {
            <div class="stat-block">
              <span class="stat-label">Total Cost / GAV ({{ currencyService.displayCurrency() }})</span>
              <span class="stat-value">{{ formatDisplayCurrency(totalCost) }}</span>
            </div>
            <div class="stat-block" [class.positive]="totalPnL >= 0" [class.negative]="totalPnL < 0">
              <span class="stat-label">Total P&L ({{ currencyService.displayCurrency() }})</span>
              <span class="stat-value">
                {{ totalPnL >= 0 ? '+' : '-' }}{{ formatDisplayCurrency(absPnL) }}
                ({{ totalPnLPercent >= 0 ? '+' : '' }}{{ totalPnLPercent.toFixed(2) }}%)
              </span>
            </div>
          }
        </div>
        <div class="holdings-table">
          <div class="table-header" [class.with-pnl]="hasCostBasis">
            <span>Ticker</span>
            <span>Shares</span>
            <span>Price</span>
            <span>Value ({{ currencyService.displayCurrency() }})</span>
            @if (hasCostBasis) {
              <span>GAK</span>
              <span>P&L ({{ currencyService.displayCurrency() }})</span>
            }
          </div>
          @for (item of entriesWithQuotes; track item.entry.symbol) {
            <div class="table-row" [class.with-pnl]="hasCostBasis">
              <span class="ticker-col">{{ item.entry.symbol }}</span>
              <span>{{ item.entry.shares }}</span>
              <span>{{ currencyService.formatNative(item.quote?.regularMarketPrice || 0, item.quote?.currency || 'USD') }}</span>
              <span>{{ currencyService.formatConverted(itemValue(item), item.quote?.currency || 'USD') }}</span>
              @if (hasCostBasis) {
                <span>{{ item.entry.avgPrice > 0 ? currencyService.formatNative(item.entry.avgPrice, item.quote?.currency || 'USD') : '—' }}</span>
                <span [class.text-green]="pnl(item) >= 0" [class.text-red]="pnl(item) < 0">
                  @if (item.entry.avgPrice > 0) {
                    {{ pnl(item) >= 0 ? '+' : '-' }}{{ currencyService.formatConverted(absPnlItem(item), item.quote?.currency || 'USD') }}
                  } @else {
                    —
                  }
                </span>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .summary-card {
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg);
      padding: 20px;
    }
    .summary-title {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
      margin-bottom: 16px;
    }
    .summary-stats {
      display: flex;
      gap: 24px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .stat-block {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .stat-block .stat-label {
      font-size: 12px;
      color: var(--text-muted);
    }
    .stat-block .stat-value {
      font-size: 20px;
      font-weight: 700;
    }
    .stat-block.positive .stat-value { color: var(--green); }
    .stat-block.negative .stat-value { color: var(--red); }
    .holdings-table {
      font-size: 13px;
    }
    .table-header {
      display: grid;
      grid-template-columns: 1fr 0.7fr 1fr 1fr;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .table-header.with-pnl {
      grid-template-columns: 1fr 0.7fr 1fr 1fr 1fr 1fr;
    }
    .table-row {
      display: grid;
      grid-template-columns: 1fr 0.7fr 1fr 1fr;
      gap: 8px;
      padding: 10px 0;
      border-bottom: 1px solid var(--border-light);
      align-items: center;
    }
    .table-row.with-pnl {
      grid-template-columns: 1fr 0.7fr 1fr 1fr 1fr 1fr;
    }
    .table-row:last-child {
      border-bottom: none;
    }
    .ticker-col {
      font-weight: 600;
    }
  `]
})
export class PortfolioSummaryComponent {
  @Input() entries: PortfolioEntry[] = [];
  @Input() quotes: Map<string, StockQuote> = new Map();

  constructor(public currencyService: CurrencyService) {}

  get entriesWithQuotes() {
    return this.entries
      .filter(e => e.shares > 0)
      .map(entry => ({
        entry,
        quote: this.quotes.get(entry.symbol)
      }));
  }

  get hasCostBasis(): boolean {
    return this.entriesWithQuotes.some(item => item.entry.avgPrice > 0);
  }

  /** Total current value converted to display currency */
  get totalValue(): number {
    return this.entriesWithQuotes.reduce((sum, item) => {
      const nativeValue = item.entry.shares * (item.quote?.regularMarketPrice || 0);
      return sum + this.currencyService.convertToDisplay(nativeValue, item.quote?.currency || 'USD');
    }, 0);
  }

  /** Total cost basis converted to display currency */
  get totalCost(): number {
    return this.entriesWithQuotes
      .filter(item => item.entry.avgPrice > 0)
      .reduce((sum, item) => {
        const nativeCost = item.entry.shares * item.entry.avgPrice;
        return sum + this.currencyService.convertToDisplay(nativeCost, item.quote?.currency || 'USD');
      }, 0);
  }

  get totalPnL(): number {
    return this.entriesWithQuotes
      .filter(item => item.entry.avgPrice > 0)
      .reduce((sum, item) => {
        const nativePnl = item.entry.shares * ((item.quote?.regularMarketPrice || 0) - item.entry.avgPrice);
        return sum + this.currencyService.convertToDisplay(nativePnl, item.quote?.currency || 'USD');
      }, 0);
  }

  get absPnL(): number {
    return Math.abs(this.totalPnL);
  }

  get totalPnLPercent(): number {
    if (this.totalCost === 0) return 0;
    return (this.totalPnL / this.totalCost) * 100;
  }

  /** Format a value already in display currency */
  formatDisplayCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currencyService.displayCurrency(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /** Native value of holding (in stock's own currency) */
  itemValue(item: { entry: PortfolioEntry; quote?: StockQuote }): number {
    return item.entry.shares * (item.quote?.regularMarketPrice || 0);
  }

  /** Native P&L (in stock's own currency) */
  pnl(item: { entry: PortfolioEntry; quote?: StockQuote }): number {
    if (item.entry.avgPrice <= 0) return 0;
    const price = item.quote?.regularMarketPrice || 0;
    return item.entry.shares * (price - item.entry.avgPrice);
  }

  absPnlItem(item: { entry: PortfolioEntry; quote?: StockQuote }): number {
    return Math.abs(this.pnl(item));
  }
}
