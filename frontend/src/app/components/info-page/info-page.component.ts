import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatsService } from '../../services/stats.service';

@Component({
  selector: 'app-info-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="info-page">
      <header class="info-header">
        <h1 class="info-title">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          Information
        </h1>
      </header>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon visitors">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Total Visitors</span>
            <span class="stat-value">{{ statsService.totalVisitors() | number }}</span>
            <span class="stat-desc">All-time page visits</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon online">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Currently Online</span>
            <span class="stat-value online-value">
              <span class="online-dot"></span>
              {{ statsService.onlineUsers() }}
            </span>
            <span class="stat-desc">Active users right now</span>
          </div>
        </div>
      </div>

      <div class="info-section">
        <h2>About Stock Overview</h2>
        <p>A real-time stock tracking dashboard with multi-portfolio support. Track your investments across different accounts with live market data, currency conversion, and portfolio analytics.</p>
      </div>

      <div class="info-section">
        <h2>Features</h2>
        <ul class="feature-list">
          <li>Real-time stock quotes with 30-second auto-refresh</li>
          <li>Multi-portfolio management (Main, 401k, Pension)</li>
          <li>Interactive candlestick charts via TradingView</li>
          <li>USD/DKK currency conversion</li>
          <li>Portfolio summary with P&L tracking</li>
          <li>Pre-market and after-hours data</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .info-page {
      max-width: 800px;
      margin: 0 auto;
      padding: 24px 32px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .info-header {
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-light);
    }
    .info-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 20px;
      font-weight: 700;
      color: var(--text-primary);
    }
    .info-title svg {
      color: var(--blue);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }
    .stat-card {
      display: flex;
      align-items: center;
      gap: 20px;
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg);
      padding: 24px;
      transition: border-color var(--transition);
    }
    .stat-card:hover {
      border-color: var(--border);
    }
    .stat-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: var(--radius-lg);
      flex-shrink: 0;
    }
    .stat-icon.visitors {
      background: var(--blue-bg);
      color: var(--blue);
    }
    .stat-icon.online {
      background: var(--green-bg);
      color: var(--green);
    }
    .stat-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .stat-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.2;
    }
    .online-value {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .online-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 8px var(--green);
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .stat-desc {
      font-size: 12px;
      color: var(--text-muted);
    }

    .info-section {
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg);
      padding: 24px;
    }
    .info-section h2 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
    }
    .info-section p {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.7;
    }
    .feature-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .feature-list li {
      font-size: 14px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .feature-list li::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--blue);
      flex-shrink: 0;
    }

    @media (max-width: 768px) {
      .info-page {
        padding: 16px;
      }
      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class InfoPageComponent implements OnInit, OnDestroy {
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor(public statsService: StatsService) {}

  ngOnInit(): void {
    this.statsService.refresh();
    // Refresh stats every 15 seconds while on this page
    this.refreshInterval = setInterval(() => this.statsService.refresh(), 15_000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}
