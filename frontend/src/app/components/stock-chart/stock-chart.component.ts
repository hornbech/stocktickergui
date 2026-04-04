import { Component, Input, OnChanges, OnDestroy, ElementRef, ViewChild, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService } from '../../services/stock.service';
import { CHART_RANGES, ChartRange } from '../../models/stock.model';

declare const LightweightCharts: any;

@Component({
  selector: 'app-stock-chart',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chart-container">
      <div class="chart-header">
        <h3>{{ symbol }}</h3>
        <div class="chart-controls">
          <div class="range-buttons">
            @for (r of ranges; track r.label) {
              <button
                [class.active]="activeRange.label === r.label"
                (click)="changeRange(r)">
                {{ r.label }}
              </button>
            }
          </div>
          <label class="indicator-toggle">
            <input type="checkbox" [(ngModel)]="showIndicators" (change)="toggleIndicators()">
            <span>MA</span>
          </label>
        </div>
      </div>
      <div #chartEl class="chart-area"></div>
      @if (loading) {
        <div class="chart-loading">
          <div class="spinner"></div>
        </div>
      }
      @if (error) {
        <div class="chart-error">Failed to load chart data</div>
      }
    </div>
  `,
  styles: [`
    .chart-container {
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg);
      padding: 20px;
      position: relative;
    }
    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .chart-header h3 {
      font-size: 16px;
      font-weight: 600;
    }
    .chart-controls {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .range-buttons {
      display: flex;
      gap: 4px;
    }
    .range-buttons button {
      padding: 6px 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-secondary);
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition);
    }
    .range-buttons button:hover {
      background: var(--bg-card-hover);
    }
    .range-buttons button.active {
      background: var(--blue);
      border-color: var(--blue);
      color: #fff;
    }
    .indicator-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-size: 12px;
      color: var(--text-secondary);
    }
    .indicator-toggle input {
      cursor: pointer;
      accent-color: var(--blue);
    }
    .indicator-toggle span {
      font-weight: 500;
    }
    .chart-area {
      height: 400px;
      width: 100%;
    }
    .chart-loading {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(13, 17, 23, 0.7);
      border-radius: var(--radius-lg);
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border);
      border-top-color: var(--blue);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .chart-error {
      text-align: center;
      padding: 40px;
      color: var(--text-muted);
    }
  `]
})
export class StockChartComponent implements OnChanges, OnDestroy {
  @Input() symbol = '';
  @ViewChild('chartEl', { static: true }) chartEl!: ElementRef;

  ranges = CHART_RANGES;
  activeRange: ChartRange = CHART_RANGES[1]; // default 5D
  showIndicators = false;
  loading = false;
  error = false;

  private chart: any = null;
  private candleSeries: any = null;
  private volumeSeries: any = null;
  private ma50Series: any = null;
  private ma200Series: any = null;
  private chartData: any[] = [];

  constructor(private stockService: StockService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['symbol'] && this.symbol) {
      this.loadChart();
    }
  }

  changeRange(range: ChartRange): void {
    this.activeRange = range;
    this.loadChart();
  }

  toggleIndicators(): void {
    if (this.chart && this.chartData.length > 0) {
      this.updateIndicators();
    }
  }

  private calculateMA(data: any[], period: number): { time: number; value: number }[] {
    const ma: { time: number; value: number }[] = [];
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close;
      }
      ma.push({
        time: data[i].time,
        value: sum / period
      });
    }
    return ma;
  }

  private updateIndicators(): void {
    if (!this.chart) return;

    if (this.showIndicators) {
      if (!this.ma50Series) {
        this.ma50Series = this.chart.addLineSeries({
          color: '#f59e0b',
          lineWidth: 1,
          title: 'MA50'
        });
        const ma50Data = this.calculateMA(this.chartData, 50);
        if (ma50Data.length > 0) {
          this.ma50Series.setData(ma50Data);
        }
      }

      if (!this.ma200Series) {
        this.ma200Series = this.chart.addLineSeries({
          color: '#8b5cf6',
          lineWidth: 1,
          title: 'MA200'
        });
        const ma200Data = this.calculateMA(this.chartData, 200);
        if (ma200Data.length > 0) {
          this.ma200Series.setData(ma200Data);
        }
      }
    } else {
      if (this.ma50Series) {
        this.ma50Series.setData([]);
      }
      if (this.ma200Series) {
        this.ma200Series.setData([]);
      }
    }
  }

  private loadChart(): void {
    if (!this.symbol) return;

    this.loading = true;
    this.error = false;

    this.stockService.getChart(this.symbol, this.activeRange.range, this.activeRange.interval)
      .subscribe({
        next: (data) => {
          this.loading = false;
          if (data.length === 0) {
            this.error = true;
            return;
          }
          this.chartData = data;
          this.renderChart(data);
        },
        error: () => {
          this.loading = false;
          this.error = true;
        }
      });
  }

  private renderChart(data: any[]): void {
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
      this.ma50Series = null;
      this.ma200Series = null;
    }

    const container = this.chartEl.nativeElement;

    this.chart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: 400,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#8b949e',
        fontFamily: 'Inter, sans-serif',
        fontSize: 12
      },
      grid: {
        vertLines: { color: 'rgba(48, 54, 61, 0.3)' },
        horzLines: { color: 'rgba(48, 54, 61, 0.3)' }
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(88, 166, 255, 0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(88, 166, 255, 0.3)', width: 1, style: 2 }
      },
      rightPriceScale: {
        borderColor: 'rgba(48, 54, 61, 0.5)'
      },
      timeScale: {
        borderColor: 'rgba(48, 54, 61, 0.5)',
        timeVisible: this.activeRange.range === '1d' || this.activeRange.range === '5d'
      },
      handleScroll: { vertTouchDrag: false },
    });

    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: '#3fb950',
      downColor: '#f85149',
      borderUpColor: '#3fb950',
      borderDownColor: '#f85149',
      wickUpColor: '#3fb950',
      wickDownColor: '#f85149'
    });

    this.candleSeries.setData(data.map((d: any) => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close
    })));

    this.volumeSeries = this.chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume'
    });

    this.chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 }
    });

    this.volumeSeries.setData(data.map((d: any) => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(63, 185, 80, 0.3)' : 'rgba(248, 81, 73, 0.3)'
    })));

    this.chart.timeScale().fitContent();

    if (this.showIndicators) {
      this.updateIndicators();
    }

    const resizeObserver = new ResizeObserver(entries => {
      if (this.chart) {
        const { width } = entries[0].contentRect;
        this.chart.applyOptions({ width });
      }
    });
    resizeObserver.observe(container);
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
    }
  }
}
