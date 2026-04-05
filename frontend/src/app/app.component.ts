import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { InfoPageComponent } from './components/info-page/info-page.component';
import { MultiPortfolioService, PortfolioName, PORTFOLIO_NAMES } from './services/multi-portfolio.service';
import { StatsService } from './services/stats.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DashboardComponent, InfoPageComponent],
  template: `
    <div class="app-container">
      <nav class="portfolio-tabs">
        @for (name of portfolioNames; track name) {
          <button
            class="tab-button"
            [class.active]="!showInfo() && portfolioService.activePortfolio() === name"
            (click)="selectPortfolio(name)">
            {{ getTabLabel(name) }}
          </button>
        }
        <span class="tab-spacer"></span>
        <button
          class="tab-button info-tab"
          [class.active]="showInfo()"
          (click)="toggleInfo()">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          Info
        </button>
      </nav>
      @if (showInfo()) {
        <app-info-page></app-info-page>
      } @else {
        <app-dashboard></app-dashboard>
      }
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
    }
    .portfolio-tabs {
      display: flex;
      gap: 4px;
      padding: 12px 32px 0;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-light);
    }
    .tab-spacer {
      flex: 1;
    }
    .tab-button {
      padding: 10px 20px;
      background: transparent;
      border: none;
      border-radius: 8px 8px 0 0;
      color: var(--text-muted);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .tab-button:hover {
      color: var(--text-secondary);
      background: var(--bg-card);
    }
    .tab-button.active {
      color: var(--blue);
      background: var(--bg-card);
      font-weight: 600;
    }
    .info-tab {
      display: flex;
      align-items: center;
      gap: 6px;
    }
  `]
})
export class AppComponent {
  portfolioNames = PORTFOLIO_NAMES;
  showInfo = signal(false);

  constructor(
    public portfolioService: MultiPortfolioService,
    private statsService: StatsService
  ) {
    this.statsService.init();
  }

  selectPortfolio(name: string): void {
    this.showInfo.set(false);
    this.portfolioService.switchPortfolio(name as PortfolioName);
  }

  toggleInfo(): void {
    this.showInfo.set(!this.showInfo());
  }

  getTabLabel(name: string): string {
    switch (name) {
      case 'default': return 'Main';
      case '401k': return '401k';
      case 'pension': return 'Pension';
      default: return name;
    }
  }
}
