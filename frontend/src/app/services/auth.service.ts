import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  authenticated = signal(false);
  checked = signal(false);
  authEnabled = signal(false);

  constructor(private http: HttpClient) {}

  checkStatus(): Observable<boolean> {
    return this.http.get<{ authenticated: boolean; authEnabled: boolean }>('/api/auth/status').pipe(
      map(res => {
        this.authenticated.set(res.authenticated);
        this.authEnabled.set(res.authEnabled);
        this.checked.set(true);
        return res.authenticated;
      }),
      catchError(() => {
        this.authenticated.set(false);
        this.checked.set(true);
        return of(false);
      })
    );
  }

  login(password: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/auth/login', { password }).pipe(
      tap(res => { if (res.success) this.authenticated.set(true); })
    );
  }

  logout(): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/auth/logout', {}).pipe(
      tap(() => this.authenticated.set(false))
    );
  }
}
