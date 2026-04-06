import { Component, OnInit } from '@angular/core';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LoginComponent } from './components/login/login.component';
import { StatsService } from './services/stats.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DashboardComponent, LoginComponent],
  template: `
    @if (!authService.checked()) {
      <div class="loading-screen"></div>
    } @else if (!authService.authenticated()) {
      <app-login></app-login>
    } @else {
      <app-dashboard></app-dashboard>
    }
  `,
  styles: [`
    .loading-screen {
      position: fixed;
      inset: 0;
      background: var(--bg-primary);
    }
  `]
})
export class AppComponent implements OnInit {
  constructor(
    private statsService: StatsService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.checkStatus().subscribe(authenticated => {
      if (authenticated) {
        this.statsService.init();
      }
    });
  }
}
