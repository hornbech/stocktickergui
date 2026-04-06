import { Injectable, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface Stats {
  totalVisitors: number;
  onlineUsers: number;
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  totalVisitors = signal(0);
  onlineUsers = signal(0);

  private sessionId = this.generateSessionId();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private http: HttpClient) {}

  /** Call once on app init to record a visit and start heartbeats. */
  init(): void {
    // Record visit
    this.http.post<Stats>('/api/stats/visit', {}).subscribe({
      next: (stats) => this.applyStats(stats),
      error: () => {}
    });

    // Start heartbeat every 20 seconds
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), 20_000);
  }

  /** Fetch latest stats without recording a visit. */
  refresh(): void {
    this.http.get<Stats>('/api/stats').subscribe({
      next: (stats) => this.applyStats(stats),
      error: () => {}
    });
  }

  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendHeartbeat(): void {
    this.http.post<Stats>('/api/stats/heartbeat', { sessionId: this.sessionId }).subscribe({
      next: (stats) => this.applyStats(stats),
      error: () => {}
    });
  }

  private applyStats(stats: Stats): void {
    this.totalVisitors.set(stats.totalVisitors);
    this.onlineUsers.set(stats.onlineUsers);
  }

  private generateSessionId(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }
}
