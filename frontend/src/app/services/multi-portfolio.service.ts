import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PortfolioEntry } from '../models/portfolio.model';

export const PORTFOLIO_NAMES = ['default', '401k', 'pension'] as const;
export type PortfolioName = typeof PORTFOLIO_NAMES[number];

export interface SinglePortfolioConfig {
  currency: string;
  tickers: string[];
  holdings: PortfolioEntry[];
  portfolioName?: string;
}

export interface MultiPortfolioConfig {
  activePortfolio: string;
  portfolios: {
    [key: string]: SinglePortfolioConfig;
  };
}

@Injectable({ providedIn: 'root' })
export class MultiPortfolioService {
  activePortfolio = signal<PortfolioName>('default');
  portfolios = signal<{ [key: string]: SinglePortfolioConfig }>({});
  loaded = signal(false);

  constructor(private http: HttpClient) {
    this.loadAllPortfolios();
  }

  private loadAllPortfolios(): void {
    this.http.get<any>('/api/portfolio').subscribe({
      next: (config) => {
        // Check if it's the new multi-portfolio format with portfolios object
        if (config.portfolios) {
          this.portfolios.set(config.portfolios);
          this.activePortfolio.set((config.activePortfolio as PortfolioName) || 'default');
        } else if (config.currency !== undefined) {
          // Legacy format - migrate to multi-portfolio
          this.portfolios.set({
            default: {
              currency: config.currency || 'USD',
              tickers: config.tickers || [],
              holdings: config.holdings || []
            }
          });
        } else {
          // Empty or invalid format - create default
          this.portfolios.set({
            default: { currency: 'USD', tickers: [], holdings: [] },
            '401k': { currency: 'USD', tickers: [], holdings: [] },
            pension: { currency: 'USD', tickers: [], holdings: [] }
          });
        }
        this.loaded.set(true);
      },
      error: () => {
        this.loaded.set(true);
      }
    });
  }

  switchPortfolio(name: PortfolioName): void {
    this.activePortfolio.set(name);
  }

  get currentPortfolio(): SinglePortfolioConfig {
    const name = this.activePortfolio();
    const all = this.portfolios();
    return all[name] || { currency: 'USD', tickers: [], holdings: [] };
  }

  get currentTickers(): string[] {
    return this.currentPortfolio.tickers;
  }

  get currentEntries(): PortfolioEntry[] {
    return this.currentPortfolio.holdings;
  }

  get currentCurrency(): string {
    return this.currentPortfolio.currency || 'USD';
  }

  symbols = computed(() => {
    const fromEntries = this.currentPortfolio.holdings.map(e => e.symbol);
    const fromTickers = this.currentPortfolio.tickers || [];
    return [...new Set([...fromTickers, ...fromEntries])];
  });

  addTicker(symbol: string): void {
    const upper = symbol.toUpperCase();
    const current = this.currentPortfolio;
    if (!current.tickers.includes(upper)) {
      const name = this.activePortfolio();
      this.http.post<SinglePortfolioConfig>(`/api/portfolio/ticker?portfolio=${name}`, { symbol: upper }).subscribe({
        next: (updated) => {
          this.updateLocalPortfolio(name, updated);
        }
      });
    }
  }

  removeTicker(symbol: string): void {
    const upper = symbol.toUpperCase();
    const name = this.activePortfolio();
    this.http.delete<SinglePortfolioConfig>(`/api/portfolio/ticker/${upper}?portfolio=${name}`).subscribe({
      next: (updated) => {
        this.updateLocalPortfolio(name, updated);
      }
    });
  }

  updateHolding(symbol: string, shares: number, avgPrice: number): void {
    const upper = symbol.toUpperCase();
    const name = this.activePortfolio();
    this.http.put<SinglePortfolioConfig>(`/api/portfolio/holding?portfolio=${name}`, { symbol: upper, shares, avgPrice }).subscribe({
      next: (updated) => {
        this.updateLocalPortfolio(name, updated);
      }
    });
  }

  private updateLocalPortfolio(name: string, updated: SinglePortfolioConfig): void {
    const all = { ...this.portfolios() };
    all[name] = {
      currency: updated.currency,
      tickers: updated.tickers || [],
      holdings: updated.holdings || []
    };
    this.portfolios.set(all);
  }

  getEntry(symbol: string): PortfolioEntry | undefined {
    return this.currentPortfolio.holdings?.find(e => e.symbol === symbol.toUpperCase());
  }
}