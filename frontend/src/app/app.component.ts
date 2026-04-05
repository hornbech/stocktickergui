import { Component } from '@angular/core';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { StatsService } from './services/stats.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DashboardComponent],
  template: `<app-dashboard></app-dashboard>`
})
export class AppComponent {
  constructor(private statsService: StatsService) {
    this.statsService.init();
  }
}
