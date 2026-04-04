import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyService, SUPPORTED_DISPLAY_CURRENCIES, DisplayCurrency } from '../../services/currency.service';

@Component({
  selector: 'app-currency-toggle',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="currency-toggle">
      <select [ngModel]="currencyService.displayCurrency()" (ngModelChange)="currencyService.setCurrency($event)">
        @for (c of currencies; track c.code) {
          <option [value]="c.code">{{ c.code }} - {{ c.name }}</option>
        }
      </select>
      <span class="rate">1 USD = {{ (currencyService.rates()['DKK'] || 6.85).toFixed(2) }} DKK</span>
    </div>
  `,
  styles: [`
    .currency-toggle {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    select {
      padding: 6px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition);
    }
    select:hover {
      border-color: var(--blue);
    }
    select:focus {
      outline: none;
      border-color: var(--blue);
    }
    .rate {
      font-size: 12px;
      color: var(--text-muted);
    }
    @media (max-width: 768px) {
      .currency-toggle {
        gap: 8px;
      }
      select {
        padding: 6px 8px;
        font-size: 12px;
      }
      .rate {
        display: none;
      }
    }
  `]
})
export class CurrencyToggleComponent {
  currencies = SUPPORTED_DISPLAY_CURRENCIES;
  constructor(public currencyService: CurrencyService) {}
}
