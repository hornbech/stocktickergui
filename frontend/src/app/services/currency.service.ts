import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type DisplayCurrency = 'USD' | 'DKK' | 'EUR' | 'GBP' | 'SEK' | 'NOK' | 'CHF' | 'CAD' | 'AUD';

export const SUPPORTED_DISPLAY_CURRENCIES: { code: DisplayCurrency; name: string }[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' }
];

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  displayCurrency = signal<DisplayCurrency>('USD');
  /** All rates relative to USD: { DKK: 6.85, GBP: 0.79, GBp: 79, ... } */
  rates = signal<Record<string, number>>({ USD: 1, DKK: 6.85, GBP: 0.79, GBp: 79 });

  constructor(private http: HttpClient) {
    this.fetchRates();
  }

  initCurrency(c: string): void {
    const supported = SUPPORTED_DISPLAY_CURRENCIES.map(x => x.code);
    if (supported.includes(c as DisplayCurrency)) {
      this.displayCurrency.set(c as DisplayCurrency);
    }
  }

  setCurrency(c: DisplayCurrency): void {
    this.displayCurrency.set(c);
    this.http.get<any>('/api/portfolio').subscribe(config => {
      config.currency = c;
      this.http.put('/api/portfolio', config).subscribe();
    });
  }

  /**
   * Format a price in its native/source currency (no conversion).
   * Use this for individual stock prices on cards.
   */
  formatNative(amount: number, sourceCurrency: string): string {
    const display = this.normalizeCurrencyCode(sourceCurrency);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: display,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(this.adjustSubunit(amount, sourceCurrency));
  }

  /**
   * Convert a price from its source currency to the user's chosen display currency.
   * Use this for portfolio totals and P&L.
   */
  formatConverted(amount: number, sourceCurrency: string): string {
    const converted = this.convertToDisplay(amount, sourceCurrency);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.displayCurrency(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(converted);
  }

  /**
   * Convert an amount from sourceCurrency to the display currency (numeric).
   */
  convertToDisplay(amount: number, sourceCurrency: string): number {
    const r = this.rates();
    const sourceRate = r[sourceCurrency] || 1;
    const targetRate = r[this.displayCurrency()] || 1;
    // amount in source -> USD -> target
    const usd = amount / sourceRate;
    return usd * targetRate;
  }

  /**
   * Get a human-readable currency label for a stock's native currency.
   */
  currencyLabel(sourceCurrency: string): string {
    if (sourceCurrency === 'GBp') return 'GBX';
    return sourceCurrency;
  }

  fetchRates(): void {
    this.http.get<Record<string, number>>('/api/currency/rates').subscribe({
      next: (data) => this.rates.set(data),
      error: () => console.warn('Failed to fetch exchange rates, using fallback')
    });
  }

  /**
   * Normalize sub-unit currencies (GBp -> GBP) for Intl.NumberFormat
   * which only supports major currency codes.
   */
  private normalizeCurrencyCode(code: string): string {
    if (code === 'GBp') return 'GBP';
    if (code === 'ILA') return 'ILS';
    return code;
  }

  /**
   * Adjust sub-unit amounts for display (e.g., GBp pence -> GBP pounds).
   */
  private adjustSubunit(amount: number, sourceCurrency: string): number {
    if (sourceCurrency === 'GBp') return amount / 100;
    if (sourceCurrency === 'ILA') return amount / 100;
    return amount;
  }
}
