import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-backdrop">
      <div class="login-card">
        <div class="login-header">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          <h1>Stock Overview</h1>
        </div>
        <form (ngSubmit)="onSubmit()" class="login-form">
          <div class="input-group">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              [(ngModel)]="password"
              name="password"
              autocomplete="current-password"
              placeholder="Enter password"
              [disabled]="loading()"
              autofocus>
          </div>
          @if (error()) {
            <div class="error-msg">{{ error() }}</div>
          }
          <button type="submit" [disabled]="loading() || !password" class="login-btn">
            @if (loading()) {
              <span class="spinner"></span>
            } @else {
              Sign in
            }
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-backdrop {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-primary);
    }
    .login-card {
      width: 100%;
      max-width: 360px;
      padding: 32px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
    }
    .login-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 28px;
      justify-content: center;
    }
    .login-header svg {
      color: var(--blue);
    }
    .login-header h1 {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .input-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .input-group label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .input-group input {
      padding: 10px 12px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text-primary);
      font-family: inherit;
      font-size: 14px;
      outline: none;
      transition: border-color var(--transition);
    }
    .input-group input:focus {
      border-color: var(--blue);
    }
    .input-group input::placeholder {
      color: var(--text-muted);
    }
    .error-msg {
      font-size: 13px;
      color: var(--red);
      padding: 8px 12px;
      background: var(--red-bg);
      border-radius: var(--radius);
    }
    .login-btn {
      padding: 10px;
      background: var(--blue);
      border: none;
      border-radius: var(--radius);
      color: #fff;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity var(--transition);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
    }
    .login-btn:hover:not(:disabled) {
      opacity: 0.9;
    }
    .login-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class LoginComponent {
  password = '';
  loading = signal(false);
  error = signal('');

  constructor(private authService: AuthService) {}

  onSubmit(): void {
    if (!this.password || this.loading()) return;
    this.loading.set(true);
    this.error.set('');

    this.authService.login(this.password).subscribe({
      next: () => {
        this.loading.set(false);
        // App component will detect auth change and show dashboard
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Login failed');
        this.password = '';
      }
    });
  }
}
