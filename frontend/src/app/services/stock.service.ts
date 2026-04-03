import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { StockQuote, ChartDataPoint, SearchResult } from '../models/stock.model';

@Injectable({ providedIn: 'root' })
export class StockService {
  constructor(private http: HttpClient) {}

  getQuotes(symbols: string[]): Observable<StockQuote[]> {
    if (symbols.length === 0) return new Observable(sub => { sub.next([]); sub.complete(); });
    return this.http.get<StockQuote[]>(`/api/quote/${symbols.join(',')}`);
  }

  getChart(symbol: string, range: string, interval: string): Observable<ChartDataPoint[]> {
    return this.http.get<ChartDataPoint[]>(`/api/chart/${symbol}?range=${range}&interval=${interval}`);
  }

  search(query: string): Observable<SearchResult[]> {
    return this.http.get<SearchResult[]>(`/api/search?q=${encodeURIComponent(query)}`);
  }
}
