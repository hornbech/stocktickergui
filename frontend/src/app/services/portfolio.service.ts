import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PortfolioEntry } from '../models/portfolio.model';

interface PortfolioConfig {
  activePortfolio: string;
  portfolios: {
    default: {
      currency: string;
      tickers: string[];
      holdings: PortfolioEntry[];
    };
    pension: {
      currency: string;
      tickers: string[];
      holdings: PortfolioEntry[];
    };
  };
}

interface PensionPortfolio {
  holdings: PortfolioEntry[];
}

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  entries = signal<PortfolioEntry[]>([]);
  tickers = signal<string[]>([]);
  pensionEntries = signal<PortfolioEntry[]>([]);
  initialCurrency = signal<string>('USD');
  loaded = signal(false);

  symbols = computed(() => {
    const fromEntries = this.entries().map(e => e.symbol);
    const fromTickers = this.tickers();
    return [...new Set([...fromTickers, ...fromEntries])];
  });

  pensionSymbols = computed(() => {
    return this.pensionEntries().map(e => e.symbol);
  });

  constructor(private http: HttpClient) {
    this.loadFromServer();
  }

  private loadFromServer(): void {
    this.http.get<PortfolioConfig>('/api/portfolio').subscribe({
      next: (config) => {
        const defaultPortfolio = config.portfolios?.default;
        const pensionPortfolio = config.portfolios?.pension;
        
        this.tickers.set(defaultPortfolio?.tickers || []);
        this.entries.set(defaultPortfolio?.holdings || []);
        this.pensionEntries.set(pensionPortfolio?.holdings || []);
        this.initialCurrency.set(defaultPortfolio?.currency || 'USD');
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

  getPensionEntry(symbol: string): PortfolioEntry | undefined {
    return this.pensionEntries().find(e => e.symbol === symbol.toUpperCase());
  }

  updatePensionHolding(symbol: string, shares: number, avgPrice: number): void {
    const upper = symbol.toUpperCase();
    const current = this.pensionEntries();
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

    this.pensionEntries.set(updated);
    this.http.put<PensionPortfolio>('/api/portfolio/pension/holding', { symbol: upper, shares, avgPrice }).subscribe();
  }

  removePensionTicker(symbol: string): void {
    const upper = symbol.toUpperCase();
    this.pensionEntries.set(this.pensionEntries().filter(e => e.symbol !== upper));
    this.http.delete<PensionPortfolio>(`/api/portfolio/pension/ticker/${upper}`).subscribe();
  }
}
