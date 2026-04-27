import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StockService } from '../../services/stock.service';
import { NewsItem } from '../../models/stock.model';

@Component({
  selector: 'app-news-ticker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="news-ticker-container">
      <div class="ticker-label">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
          <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z"/>
        </svg>
        NEWS
      </div>
      <div class="ticker-viewport">
        @if (loading()) {
          <div class="ticker-loading">Loading news...</div>
        } @else if (newsItems().length === 0) {
          <div class="ticker-loading">No news available</div>
        } @else {
          <div class="ticker-content" [style.animation-duration]="scrollDuration()">
            @for (item of newsItems(); track item.guid) {
              <a class="ticker-item" [href]="item.link" target="_blank" rel="noopener noreferrer">
                @for (sym of item.symbols || []; track sym) {
                  <span class="ticker-symbol">{{ sym }}</span>
                }
                <span class="ticker-title">{{ item.title }}</span>
                <span class="ticker-source">{{ item.source }}</span>
              </a>
              <span class="ticker-separator">•</span>
            }
            @for (item of newsItems(); track item.guid + '_dup') {
              <a class="ticker-item" [href]="item.link" target="_blank" rel="noopener noreferrer">
                @for (sym of item.symbols || []; track sym) {
                  <span class="ticker-symbol">{{ sym }}</span>
                }
                <span class="ticker-title">{{ item.title }}</span>
                <span class="ticker-source">{{ item.source }}</span>
              </a>
              <span class="ticker-separator">•</span>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .news-ticker-container {
      display: flex;
      align-items: center;
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius);
      overflow: hidden;
      height: 44px;
    }
    .ticker-label {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 16px;
      background: var(--blue-bg);
      color: var(--blue);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      height: 100%;
      white-space: nowrap;
      border-right: 1px solid var(--border-light);
    }
    .ticker-viewport {
      flex: 1;
      overflow: hidden;
      height: 100%;
      position: relative;
    }
    .ticker-content {
      display: flex;
      align-items: center;
      height: 100%;
      animation: scroll linear infinite;
      will-change: transform;
    }
    .ticker-content:hover {
      animation-play-state: paused;
    }
    @keyframes scroll {
      0% {
        transform: translateX(0);
      }
      100% {
        transform: translateX(-50%);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .ticker-content {
        animation: none;
        overflow-x: auto;
      }
    }
    .ticker-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 0 16px;
      text-decoration: none;
      color: var(--text-secondary);
      font-size: 13px;
      white-space: nowrap;
      transition: color var(--transition);
    }
    .ticker-item:hover {
      color: var(--blue);
    }
    .ticker-symbol {
      font-weight: 600;
      color: var(--text-primary);
      background: var(--bg-secondary);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
    }
    .ticker-title {
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ticker-source {
      color: var(--text-muted);
      font-size: 11px;
    }
    .ticker-separator {
      color: var(--border);
      padding: 0 4px;
    }
    .ticker-loading {
      display: flex;
      align-items: center;
      height: 100%;
      padding: 0 16px;
      color: var(--text-muted);
      font-size: 13px;
    }
    @media (max-width: 768px) {
      .news-ticker-container {
        height: 38px;
      }
      .ticker-label {
        padding: 0 10px;
        font-size: 10px;
        gap: 4px;
      }
      .ticker-label svg {
        width: 13px;
        height: 13px;
      }
      .ticker-item {
        font-size: 12px;
        gap: 6px;
        padding: 0 10px;
      }
      .ticker-title {
        max-width: 250px;
      }
    }
  `]
})
export class NewsTickerComponent implements OnInit, OnDestroy, OnChanges {
  @Input() symbols: string[] = [];

  newsItems = signal<NewsItem[]>([]);
  scrollDuration = signal('60s');
  loading = signal(true);

  private refreshInterval?: ReturnType<typeof setInterval>;
  private visibilityHandler?: () => void;
  private prevSymbolsKey = '';

  constructor(private stockService: StockService) {}

  ngOnInit(): void {
    this.fetchNews();
    this.refreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.fetchNews();
      }
    }, 60000);
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        this.fetchNews();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['symbols']) {
      const newKey = [...this.symbols].sort().join(',');
      if (newKey !== this.prevSymbolsKey) {
        this.prevSymbolsKey = newKey;
        this.fetchNews();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  private fetchNews(): void {
    if (this.symbols.length === 0) {
      this.newsItems.set([]);
      this.loading.set(false);
      return;
    }
    const isInitialLoad = this.newsItems().length === 0;
    if (isInitialLoad) {
      this.loading.set(true);
    }
    this.stockService.getNews(this.symbols).subscribe({
      next: (news) => {
        this.newsItems.set(news);
        this.loading.set(false);
        const baseDuration = Math.max(30, news.length * 3);
        this.scrollDuration.set(`${baseDuration}s`);
      },
      error: (err) => {
        console.error('Failed to fetch news:', err);
        this.loading.set(false);
      }
    });
  }
}
