import { Component } from '@angular/core';
import { CurrencyService } from '../../services/currency.service';

@Component({
  selector: 'app-currency-toggle',
  standalone: true,
  template: `
    <div class="currency-toggle">
      <button
        [class.active]="currencyService.displayCurrency() === 'USD'"
        (click)="currencyService.setCurrency('USD')">
        USD
      </button>
      <button
        [class.active]="currencyService.displayCurrency() === 'DKK'"
        (click)="currencyService.setCurrency('DKK')">
        DKK
      </button>
      <span class="rate">1 USD = {{ (currencyService.rates()['DKK'] || 6.85).toFixed(2) }} DKK</span>
    </div>
  `,
  styles: [`
    .currency-toggle {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    button {
      padding: 6px 16px;
      border: 1px solid var(--border);
      background: var(--bg-secondary);
      color: var(--text-secondary);
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition);
    }
    button:first-child {
      border-radius: var(--radius) 0 0 var(--radius);
    }
    button:nth-child(2) {
      border-radius: 0 var(--radius) var(--radius) 0;
      border-left: none;
    }
    button.active {
      background: var(--blue);
      border-color: var(--blue);
      color: #fff;
    }
    button:hover:not(.active) {
      background: var(--bg-card-hover);
    }
    .rate {
      margin-left: 12px;
      font-size: 12px;
      color: var(--text-muted);
    }
  `]
})
export class CurrencyToggleComponent {
  constructor(public currencyService: CurrencyService) {}
}
