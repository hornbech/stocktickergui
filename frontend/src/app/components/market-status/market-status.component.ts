import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-market-status',
  standalone: true,
  template: `
    <div class="market-status" [class]="statusClass">
      <span class="dot"></span>
      <span class="label">{{ statusLabel }}</span>
    </div>
  `,
  styles: [`
    .market-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .open { background: var(--green-bg); color: var(--green); }
    .open .dot { background: var(--green); box-shadow: 0 0 6px var(--green); }
    .pre { background: var(--blue-bg); color: var(--blue); }
    .pre .dot { background: var(--blue); box-shadow: 0 0 6px var(--blue); }
    .post { background: rgba(210, 153, 34, 0.1); color: var(--yellow); }
    .post .dot { background: var(--yellow); box-shadow: 0 0 6px var(--yellow); }
    .closed { background: rgba(139, 148, 158, 0.1); color: var(--text-secondary); }
    .closed .dot { background: var(--text-muted); }
  `]
})
export class MarketStatusComponent {
  @Input() marketState: string = 'CLOSED';

  get statusClass(): string {
    switch (this.marketState) {
      case 'PRE': return 'pre';
      case 'REGULAR': return 'open';
      case 'POST': case 'POSTPOST': return 'post';
      default: return 'closed';
    }
  }

  get statusLabel(): string {
    switch (this.marketState) {
      case 'PRE': return 'Pre-Market';
      case 'REGULAR': return 'Market Open';
      case 'POST': case 'POSTPOST': return 'After Hours';
      default: return 'Market Closed';
    }
  }
}
