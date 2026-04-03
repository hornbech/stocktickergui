import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PortfolioEntry } from '../models/portfolio.model';

interface PortfolioConfig {
  currency: string;
  tickers: string[];
  holdings: PortfolioEntry[];
}

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  entries = signal<PortfolioEntry[]>([]);
  tickers = signal<string[]>([]);
  initialCurrency = signal<string>('USD');
  loaded = signal(false);

  symbols = computed(() => {
    const fromEntries = this.entries().map(e => e.symbol);
    const fromTickers = this.tickers();
    return [...new Set([...fromTickers, ...fromEntries])];
  });

  constructor(private http: HttpClient) {
    this.loadFromServer();
  }

  private loadFromServer(): void {
    this.http.get<PortfolioConfig>('/api/portfolio').subscribe({
      next: (config) => {
        this.tickers.set(config.tickers || []);
        this.entries.set(config.holdings || []);
        this.initialCurrency.set(config.currency || 'USD');
        this.loaded.set(true);
      },
      error: () => {
        this.loaded.set(true);
      }
    });
  }

  addTicker(symbol: string): void {
    const upper = symbol.toUpperCase();
    const current = this.tickers();
    if (!current.includes(upper)) {
      this.tickers.set([...current, upper]);
      this.http.post<PortfolioConfig>('/api/portfolio/ticker', { symbol: upper }).subscribe();
    }
  }

  removeTicker(symbol: string): void {
    const upper = symbol.toUpperCase();
    this.tickers.set(this.tickers().filter(t => t !== upper));
    this.entries.set(this.entries().filter(e => e.symbol !== upper));
    this.http.delete<PortfolioConfig>(`/api/portfolio/ticker/${upper}`).subscribe();
  }

  updateHolding(symbol: string, shares: number, avgPrice: number): void {
    const upper = symbol.toUpperCase();
    const current = this.entries();
    const idx = current.findIndex(e => e.symbol === upper);

    let updated: PortfolioEntry[];
    if (shares === 0 && avgPrice === 0) {
      updated = current.filter(e => e.symbol !== upper);
    } else if (idx >= 0) {
      updated = [...current];
      updated[idx] = { symbol: upper, shares, avgPrice };
    } else {
      updated = [...current, { symbol: upper, shares, avgPrice }];
    }

    this.entries.set(updated);
    this.http.put<PortfolioConfig>('/api/portfolio/holding', { symbol: upper, shares, avgPrice }).subscribe();
  }

  getEntry(symbol: string): PortfolioEntry | undefined {
    return this.entries().find(e => e.symbol === symbol.toUpperCase());
  }
}
