import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService } from '../../services/stock.service';
import { SearchResult } from '../../models/stock.model';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';

@Component({
  selector: 'app-ticker-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ticker-input-wrapper">
      <div class="input-group">
        <svg class="search-icon" viewBox="0 0 16 16" width="16" height="16">
          <path fill="currentColor" d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 1 1-1.06 1.06l-3.04-3.04ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"/>
        </svg>
        <input
          type="text"
          [(ngModel)]="query"
          (ngModelChange)="onQueryChange($event)"
          (keydown.enter)="addDirect()"
          placeholder="Search ticker or company name..."
          class="search-input"
          (focus)="showResults = true"
          (blur)="onBlur()"
        />
        <button class="add-btn" (click)="addDirect()" [disabled]="!query.trim()">Add</button>
      </div>
      @if (showResults && results.length > 0) {
        <div class="results-dropdown">
          @for (r of results; track r.symbol) {
            <button class="result-item" (mousedown)="selectResult(r)">
              <span class="result-symbol">{{ r.symbol }}</span>
              <span class="result-name">{{ r.name }}</span>
              <span class="result-exchange">{{ r.exchange }}</span>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .ticker-input-wrapper {
      position: relative;
      width: 100%;
      max-width: 480px;
    }
    .input-group {
      display: flex;
      align-items: center;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      transition: border-color var(--transition);
    }
    .input-group:focus-within {
      border-color: var(--blue);
    }
    .search-icon {
      margin-left: 12px;
      color: var(--text-muted);
      flex-shrink: 0;
    }
    .search-input {
      flex: 1;
      padding: 10px 12px;
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-family: inherit;
      font-size: 14px;
      outline: none;
    }
    .search-input::placeholder {
      color: var(--text-muted);
    }
    .add-btn {
      padding: 8px 20px;
      margin: 3px;
      background: var(--blue);
      border: none;
      border-radius: 6px;
      color: #fff;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity var(--transition);
    }
    .add-btn:hover { opacity: 0.85; }
    .add-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .results-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-lg);
      z-index: 100;
      max-height: 300px;
      overflow-y: auto;
    }
    .result-item {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 14px;
      border: none;
      background: transparent;
      color: var(--text-primary);
      font-family: inherit;
      font-size: 13px;
      cursor: pointer;
      text-align: left;
      transition: background var(--transition);
    }
    .result-item:hover {
      background: var(--bg-card-hover);
    }
    .result-symbol {
      font-weight: 600;
      min-width: 70px;
      color: var(--blue);
    }
    .result-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .result-exchange {
      font-size: 11px;
      color: var(--text-muted);
    }
  `]
})
export class TickerInputComponent {
  @Output() tickerAdded = new EventEmitter<string>();

  query = '';
  results: SearchResult[] = [];
  showResults = false;
  private searchSubject = new Subject<string>();

  constructor(private stockService: StockService) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => q.length >= 1 ? this.stockService.search(q) : of([]))
    ).subscribe(results => {
      this.results = results;
      this.showResults = results.length > 0;
    });
  }

  onQueryChange(value: string): void {
    this.searchSubject.next(value);
  }

  selectResult(result: SearchResult): void {
    this.tickerAdded.emit(result.symbol);
    this.query = '';
    this.results = [];
    this.showResults = false;
  }

  addDirect(): void {
    const symbol = this.query.trim().toUpperCase();
    if (symbol) {
      this.tickerAdded.emit(symbol);
      this.query = '';
      this.results = [];
      this.showResults = false;
    }
  }

  onBlur(): void {
    setTimeout(() => this.showResults = false, 200);
  }
}
