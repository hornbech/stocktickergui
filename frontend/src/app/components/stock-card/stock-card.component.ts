import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockQuote } from '../../models/stock.model';
import { PortfolioEntry } from '../../models/portfolio.model';
import { CurrencyService } from '../../services/currency.service';
import { PortfolioService } from '../../services/portfolio.service';
import { MarketStatusComponent } from '../market-status/market-status.component';

@Component({
  selector: 'app-stock-card',
  standalone: true,
  imports: [CommonModule, FormsModule, MarketStatusComponent, TitleCasePipe],
  template: `
    <div class="card" [class.selected]="selected" (click)="cardClicked.emit(quote.symbol)">
      <div class="card-header">
        <div class="ticker-info">
          <div class="symbol-row">
            <span class="symbol">{{ quote.symbol }}</span>
            <span class="currency-badge">{{ currencyService.currencyLabel(quote.currency) }}</span>
          </div>
          <span class="name">{{ quote.shortName }}</span>
        </div>
        <div class="header-right">
          <app-market-status [marketState]="quote.marketState"></app-market-status>
          <button class="remove-btn" (click)="remove($event)" title="Remove ticker">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path fill="currentColor" d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.749.749 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.749.749 0 1 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="price-section">
        <span class="current-price">{{ currencyService.formatNative(quote.regularMarketPrice, quote.currency) }}</span>
        <span class="change" [class.positive]="quote.regularMarketChange >= 0" [class.negative]="quote.regularMarketChange < 0">
          {{ quote.regularMarketChange >= 0 ? '+' : '' }}{{ quote.regularMarketChange?.toFixed(2) }}
          ({{ quote.regularMarketChangePercent >= 0 ? '+' : '' }}{{ quote.regularMarketChangePercent?.toFixed(2) }}%)
        </span>
      </div>

      @if (quote.marketState === 'PRE' && quote.preMarketPrice) {
        <div class="extended-hours">
          <span class="eh-label">Pre-Market</span>
          <span class="eh-price">{{ currencyService.formatNative(quote.preMarketPrice, quote.currency) }}</span>
          <span class="change small" [class.positive]="(quote.preMarketChange ?? 0) >= 0" [class.negative]="(quote.preMarketChange ?? 0) < 0">
            {{ (quote.preMarketChange ?? 0) >= 0 ? '+' : '' }}{{ quote.preMarketChange?.toFixed(2) }}
            ({{ (quote.preMarketChangePercent ?? 0) >= 0 ? '+' : '' }}{{ quote.preMarketChangePercent?.toFixed(2) }}%)
          </span>
        </div>
      }
      @if ((quote.marketState === 'POST' || quote.marketState === 'POSTPOST') && quote.postMarketPrice) {
        <div class="extended-hours">
          <span class="eh-label">After Hours</span>
          <span class="eh-price">{{ currencyService.formatNative(quote.postMarketPrice, quote.currency) }}</span>
          <span class="change small" [class.positive]="(quote.postMarketChange ?? 0) >= 0" [class.negative]="(quote.postMarketChange ?? 0) < 0">
            {{ (quote.postMarketChange ?? 0) >= 0 ? '+' : '' }}{{ quote.postMarketChange?.toFixed(2) }}
            ({{ (quote.postMarketChangePercent ?? 0) >= 0 ? '+' : '' }}{{ quote.postMarketChangePercent?.toFixed(2) }}%)
          </span>
        </div>
      }

      <div class="stats-grid">
        <div class="stat">
          <span class="stat-label">Day Range</span>
          <span class="stat-value">{{ quote.regularMarketDayLow?.toFixed(2) }} - {{ quote.regularMarketDayHigh?.toFixed(2) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">52W Range</span>
          <span class="stat-value">{{ quote.fiftyTwoWeekLow?.toFixed(2) }} - {{ quote.fiftyTwoWeekHigh?.toFixed(2) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Volume</span>
          <span class="stat-value">{{ formatNumber(quote.regularMarketVolume) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Avg Volume</span>
          <span class="stat-value">{{ formatNumber(quote.averageDailyVolume3Month) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Market Cap</span>
          <span class="stat-value">{{ formatMarketCap(quote.marketCap) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">P/E (TTM)</span>
          <span class="stat-value">{{ quote.trailingPE ? quote.trailingPE.toFixed(2) : 'N/A' }}</span>
        </div>
      </div>

      <div class="indicators-section">
        <div class="indicators-header" (click)="toggleIndicators($event)">
          <span>Indicators</span>
          <svg [class.expanded]="showIndicators" viewBox="0 0 16 16" width="12" height="12">
            <path fill="currentColor" d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"/>
          </svg>
        </div>
        @if (showIndicators) {
          <div class="indicators-grid fade-in">
            <div class="indicator">
              <span class="ind-label">Beta</span>
              <span class="ind-value" [class.positive]="(quote.beta ?? 1) > 1" [class.negative]="(quote.beta ?? 1) < 1">
                {{ quote.beta ? quote.beta.toFixed(2) : 'N/A' }}
              </span>
            </div>
            <div class="indicator">
              <span class="ind-label">Div Yield</span>
              <span class="ind-value">{{ quote.dividendYield ? quote.dividendYield.toFixed(2) + '%' : 'N/A' }}</span>
            </div>
            <div class="indicator">
              <span class="ind-label">EPS (TTM)</span>
              <span class="ind-value">{{ quote.epsTrailingTwelveMonths ? currencyService.formatNative(quote.epsTrailingTwelveMonths, quote.currency) : 'N/A' }}</span>
            </div>
            <div class="indicator">
              <span class="ind-label">EPS Fwd</span>
              <span class="ind-value">{{ quote.epsForward ? currencyService.formatNative(quote.epsForward, quote.currency) : 'N/A' }}</span>
            </div>
            <div class="indicator">
              <span class="ind-label">MA50</span>
              <span class="ind-value" [class.positive]="priceVsMA(quote.fiftyDayAverage) >= 0" [class.negative]="priceVsMA(quote.fiftyDayAverage) < 0">
                {{ quote.fiftyDayAverage ? currencyService.formatNative(quote.fiftyDayAverage, quote.currency) : 'N/A' }}
                @if (quote.fiftyDayAverageChangePercent !== null) {
                  <span class="ma-pct">({{ quote.fiftyDayAverageChangePercent >= 0 ? '+' : '' }}{{ quote.fiftyDayAverageChangePercent?.toFixed(1) }}%)</span>
                }
              </span>
            </div>
            <div class="indicator">
              <span class="ind-label">MA200</span>
              <span class="ind-value" [class.positive]="priceVsMA(quote.twoHundredDayAverage) >= 0" [class.negative]="priceVsMA(quote.twoHundredDayAverage) < 0">
                {{ quote.twoHundredDayAverage ? currencyService.formatNative(quote.twoHundredDayAverage, quote.currency) : 'N/A' }}
                @if (quote.twoHundredDayAverageChangePercent !== null) {
                  <span class="ma-pct">({{ quote.twoHundredDayAverageChangePercent >= 0 ? '+' : '' }}{{ quote.twoHundredDayAverageChangePercent?.toFixed(1) }}%)</span>
                }
              </span>
            </div>
            @if (quote.analystTargetPrice) {
              <div class="indicator">
                <span class="ind-label">Target</span>
                <span class="ind-value" [class.positive]="quote.regularMarketPrice < quote.analystTargetPrice" [class.negative]="quote.regularMarketPrice > quote.analystTargetPrice">
                  {{ currencyService.formatNative(quote.analystTargetPrice, quote.currency) }}
                </span>
              </div>
            }
            @if (quote.recommendationKey) {
              <div class="indicator">
                <span class="ind-label">Rating</span>
                <span class="ind-value rating" [class]="'rating-' + quote.recommendationKey">
                  {{ quote.recommendationKey | titlecase }}
                </span>
              </div>
            }
          </div>
        }
      </div>

      @if (showHoldingsSection) {
        <div class="holdings-section">
          <div class="holdings-header" (click)="toggleHoldings($event)">
            <span>Holdings (GAK)</span>
            <svg [class.expanded]="showHoldings" viewBox="0 0 16 16" width="12" height="12">
              <path fill="currentColor" d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"/>
            </svg>
          </div>
          @if (showHoldings) {
            <div class="holdings-form fade-in">
              <div class="form-row">
                <label>Shares</label>
                <input type="number" [ngModel]="holdingShares" (ngModelChange)="holdingShares = $event" (blur)="saveHolding()" min="0" step="1" placeholder="0">
              </div>
              <div class="form-row">
                <label>Avg Price (GAK)</label>
                <input type="number" [ngModel]="holdingAvgPrice" (ngModelChange)="holdingAvgPrice = $event" (blur)="saveHolding()" min="0" step="0.01" placeholder="0.00">
              </div>
              @if (holdingShares > 0) {
                <div class="pnl-display">
                  <div class="pnl-row">
                    <span>Current Value</span>
                    <span>{{ currencyService.formatNative(holdingShares * quote.regularMarketPrice, quote.currency) }}</span>
                  </div>
                  @if (holdingAvgPrice > 0) {
                    <div class="pnl-row">
                      <span>Cost Basis (GAV)</span>
                      <span>{{ currencyService.formatNative(holdingShares * holdingAvgPrice, quote.currency) }}</span>
                    </div>
                    <div class="pnl-row pnl-total" [class.positive]="unrealizedPnL >= 0" [class.negative]="unrealizedPnL < 0">
                      <span>Unrealized P&L</span>
                      <span>
                        {{ unrealizedPnL >= 0 ? '+' : '' }}{{ currencyService.formatNative(Math.abs(unrealizedPnL), quote.currency) }}
                        ({{ unrealizedPnLPercent >= 0 ? '+' : '' }}{{ unrealizedPnLPercent.toFixed(2) }}%)
                      </span>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg);
      padding: 20px;
      cursor: pointer;
      transition: all var(--transition);
    }
    .card:hover {
      border-color: var(--border);
      box-shadow: var(--shadow);
    }
    .card.selected {
      border-color: var(--blue);
      box-shadow: 0 0 0 1px var(--blue);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .ticker-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .symbol-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .symbol {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .currency-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      color: var(--text-muted);
      letter-spacing: 0.5px;
    }
    .name {
      font-size: 12px;
      color: var(--text-secondary);
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .remove-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all var(--transition);
      display: flex;
    }
    .remove-btn:hover {
      background: var(--red-bg);
      color: var(--red);
    }
    .price-section {
      margin-bottom: 12px;
    }
    .current-price {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .change {
      display: inline-block;
      margin-left: 10px;
      font-size: 14px;
      font-weight: 500;
    }
    .change.small {
      font-size: 12px;
      margin-left: 8px;
    }
    .change.positive { color: var(--green); }
    .change.negative { color: var(--red); }
    .extended-hours {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      margin-bottom: 8px;
      border-top: 1px solid var(--border-light);
      font-size: 13px;
    }
    .eh-label {
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .eh-price {
      font-weight: 600;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 12px 0;
      border-top: 1px solid var(--border-light);
    }
    .stat {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .stat-label {
      font-size: 12px;
      color: var(--text-muted);
    }
    .stat-value {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
    }
    .holdings-section {
      border-top: 1px solid var(--border-light);
      padding-top: 12px;
      margin-top: 4px;
    }
    .holdings-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .holdings-header svg {
      transition: transform var(--transition);
    }
    .holdings-header svg.expanded {
      transform: rotate(180deg);
    }
    .holdings-form {
      padding-top: 10px;
    }
    .form-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .form-row label {
      font-size: 12px;
      color: var(--text-muted);
    }
    .form-row input {
      width: 120px;
      padding: 6px 10px;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-primary);
      font-family: inherit;
      font-size: 13px;
      text-align: right;
      outline: none;
      transition: border-color var(--transition);
    }
    .form-row input:focus {
      border-color: var(--blue);
    }
    .form-row input::-webkit-inner-spin-button,
    .form-row input::-webkit-outer-spin-button {
      opacity: 0.3;
    }
    .pnl-display {
      margin-top: 8px;
      padding: 10px;
      background: var(--bg-secondary);
      border-radius: var(--radius);
    }
    .pnl-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      padding: 3px 0;
      color: var(--text-secondary);
    }
    .pnl-total {
      border-top: 1px solid var(--border-light);
      margin-top: 4px;
      padding-top: 6px;
      font-weight: 600;
    }
    .pnl-total.positive { color: var(--green); }
    .pnl-total.negative { color: var(--red); }
    .indicators-section {
      border-top: 1px solid var(--border-light);
      padding-top: 12px;
      margin-top: 4px;
    }
    .indicators-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .indicators-header svg {
      transition: transform var(--transition);
    }
    .indicators-header svg.expanded {
      transform: rotate(180deg);
    }
    .indicators-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      padding-top: 10px;
    }
    .indicator {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .ind-label {
      font-size: 11px;
      color: var(--text-muted);
    }
    .ind-value {
      font-size: 11px;
      font-weight: 500;
      color: var(--text-secondary);
      text-align: right;
    }
    .ind-value.positive { color: var(--green); }
    .ind-value.negative { color: var(--red); }
    .ma-pct {
      font-size: 10px;
      margin-left: 2px;
      opacity: 0.8;
    }
    .ind-value.rating {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
    }
    .rating-strongBuy, .rating-buy { background: rgba(34, 197, 94, 0.15); color: var(--green); }
    .rating-hold { background: rgba(234, 179, 8, 0.15); color: #eab308; }
    .rating-sell, .rating-strongSell { background: rgba(239, 68, 68, 0.15); color: var(--red); }
    @media (max-width: 768px) {
      .card {
        padding: 14px;
      }
      .symbol {
        font-size: 16px;
      }
      .name {
        max-width: 160px;
        font-size: 11px;
      }
      .current-price {
        font-size: 22px;
      }
      .change {
        font-size: 12px;
        margin-left: 6px;
      }
      .stats-grid {
        grid-template-columns: 1fr;
        gap: 6px;
      }
      .form-row input {
        width: 100px;
      }
    }
  `]
})
export class StockCardComponent {
  @Input() quote!: StockQuote;
  @Input() selected = false;
  @Input() showHoldingsSection = true;
  @Output() cardClicked = new EventEmitter<string>();
  @Output() removed = new EventEmitter<string>();

  showHoldings = false;
  showIndicators = false;
  holdingShares = 0;
  holdingAvgPrice = 0;
  Math = Math;

  constructor(
    public currencyService: CurrencyService,
    private portfolioService: PortfolioService
  ) {}

  ngOnInit(): void {
    const entry = this.portfolioService.getEntry(this.quote.symbol);
    if (entry) {
      this.holdingShares = entry.shares;
      this.holdingAvgPrice = entry.avgPrice;
      this.showHoldings = true;
    }
  }

  get unrealizedPnL(): number {
    return this.holdingShares * (this.quote.regularMarketPrice - this.holdingAvgPrice);
  }

  get unrealizedPnLPercent(): number {
    if (this.holdingAvgPrice === 0) return 0;
    return ((this.quote.regularMarketPrice - this.holdingAvgPrice) / this.holdingAvgPrice) * 100;
  }

  toggleHoldings(event: Event): void {
    event.stopPropagation();
    this.showHoldings = !this.showHoldings;
  }

  toggleIndicators(event: Event): void {
    event.stopPropagation();
    this.showIndicators = !this.showIndicators;
  }

  priceVsMA(ma: number | null): number {
    if (!ma) return 0;
    return ((this.quote.regularMarketPrice - ma) / ma) * 100;
  }

  saveHolding(): void {
    this.portfolioService.updateHolding(this.quote.symbol, this.holdingShares, this.holdingAvgPrice);
  }

  remove(event: Event): void {
    event.stopPropagation();
    this.removed.emit(this.quote.symbol);
  }

  formatNumber(n: number): string {
    if (!n) return 'N/A';
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  formatMarketCap(n: number): string {
    if (!n) return 'N/A';
    if (n >= 1_000_000_000_000) return (n / 1_000_000_000_000).toFixed(2) + 'T';
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    return n.toLocaleString();
  }
}
