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
        <table class="holdings-table">
          <thead>
            <tr>
              <th scope="col">Ticker</th>
              <th scope="col">Shares</th>
              <th scope="col">Price</th>
              <th scope="col">Value ({{ currencyService.displayCurrency() }})</th>
              @if (hasCostBasis) {
                <th scope="col">GAK</th>
                <th scope="col">P&amp;L ({{ currencyService.displayCurrency() }})</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (item of entriesWithQuotes; track item.entry.symbol) {
              <tr>
                <td class="ticker-col">{{ item.entry.symbol }}</td>
                <td>{{ item.entry.shares }}</td>
                <td>{{ currencyService.formatNative(item.quote?.regularMarketPrice || 0, item.quote?.currency || 'USD') }}</td>
                <td>{{ currencyService.formatConverted(itemValue(item), item.quote?.currency || 'USD') }}</td>
                @if (hasCostBasis) {
                  <td>{{ item.entry.avgPrice > 0 ? currencyService.formatNative(item.entry.avgPrice, item.quote?.currency || 'USD') : '—' }}</td>
                  <td [class.text-green]="pnl(item) >= 0" [class.text-red]="pnl(item) < 0">
                    @if (item.entry.avgPrice > 0) {
                      {{ pnl(item) >= 0 ? '+' : '-' }}{{ currencyService.formatConverted(absPnlItem(item), item.quote?.currency || 'USD') }}
                    } @else {
                      —
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
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
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .holdings-table th {
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      padding: 6px 8px;
      border-bottom: 1px solid var(--border);
    }
    .holdings-table td {
      padding: 10px 8px;
      border-bottom: 1px solid var(--border-light);
      color: var(--text-primary);
    }
    .holdings-table tbody tr:last-child td {
      border-bottom: none;
    }
    .holdings-table tbody tr:hover {
      background: var(--bg-card-hover);
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
