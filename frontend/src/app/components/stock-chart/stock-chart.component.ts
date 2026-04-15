import { Component, Input, OnChanges, OnDestroy, ElementRef, ViewChild, SimpleChanges, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService } from '../../services/stock.service';
import { CHART_RANGES, ChartRange, RegularHours } from '../../models/stock.model';

declare const LightweightCharts: any;

interface ChartIndicators {
  ema20: boolean;
  sma50: boolean;
  sma200: boolean;
  bollingerBands: boolean;
  volume: boolean;
  rsi: boolean;
  macd: boolean;
}

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
          @if (intervalOptions.length > 0) {
            <div class="interval-buttons">
              @for (opt of intervalOptions; track opt.interval) {
                <button
                  [class.active]="activeInterval() === opt.interval"
                  (click)="changeInterval(opt.interval)">
                  {{ opt.label }}
                </button>
              }
            </div>
          }
          <div class="indicator-buttons">
            @for (ind of indicatorList; track ind.key) {
              <button
                class="indicator-btn"
                [class.active]="indicators()[ind.key]"
                (click)="toggleIndicator(ind.key)">
                {{ ind.label }}
              </button>
            }
          </div>
        </div>
      </div>

      <div #mainChartEl class="chart-area main-chart"></div>

      @if (indicators().rsi) {
        <div class="sub-panel">
          <div class="sub-panel-header">
            <span>RSI(14)</span>
            <span class="rsi-value" [class.overbought]="rsiValue() > 70" [class.oversold]="rsiValue() < 30">
              {{ rsiValue() | number:'1.1-1' }}
            </span>
          </div>
          <div #rsiChartEl class="chart-area sub-chart"></div>
        </div>
      }

      @if (indicators().macd) {
        <div class="sub-panel">
          <div class="sub-panel-header">
            <span>MACD(12,26,9)</span>
            <span class="macd-values">
              <span>M: {{ macdValue().macd | number:'1.2-2' }}</span>
              <span>S: {{ macdValue().signal | number:'1.2-2' }}</span>
              <span>H: {{ macdValue().histogram | number:'1.2-2' }}</span>
            </span>
          </div>
          <div #macdChartEl class="chart-area sub-chart"></div>
        </div>
      }

      @if (indicators().volume) {
        <div class="sub-panel">
          <div class="sub-panel-header">
            <span>Volume</span>
          </div>
          <div #volumeChartEl class="chart-area sub-chart"></div>
        </div>
      }

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
      align-items: flex-start;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .chart-header h3 {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
    }
    .chart-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
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
    .interval-buttons {
      display: flex;
      gap: 4px;
    }
    .interval-buttons button {
      padding: 4px 10px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-muted);
      font-family: inherit;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition);
    }
    .interval-buttons button:hover {
      background: var(--bg-card-hover);
      color: var(--text-secondary);
    }
    .interval-buttons button.active {
      background: var(--blue);
      border-color: var(--blue);
      color: #fff;
    }
    .indicator-buttons {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .indicator-btn {
      padding: 5px 10px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text-muted);
      font-family: inherit;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition);
    }
    .indicator-btn:hover {
      border-color: var(--text-secondary);
      color: var(--text-secondary);
    }
    .indicator-btn.active {
      background: var(--blue-bg);
      border-color: var(--blue);
      color: var(--blue);
    }
    .chart-area {
      width: 100%;
    }
    .main-chart {
      height: 350px;
    }
    .sub-chart {
      height: 100px;
    }
    .sub-panel {
      margin-top: 8px;
      border-top: 1px solid var(--border-light);
      padding-top: 12px;
    }
    .sub-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 12px;
      color: var(--text-secondary);
    }
    .rsi-value {
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .rsi-value.overbought {
      background: var(--red-bg);
      color: var(--red);
    }
    .rsi-value.oversold {
      background: var(--green-bg);
      color: var(--green);
    }
    .macd-values {
      display: flex;
      gap: 12px;
      font-size: 11px;
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
    @media (max-width: 768px) {
      .chart-container {
        padding: 12px;
      }
      .chart-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 10px;
      }
      .chart-header h3 {
        font-size: 14px;
      }
      .chart-controls {
        width: 100%;
        flex-direction: column;
        gap: 8px;
      }
      .range-buttons {
        width: 100%;
        justify-content: space-between;
      }
      .range-buttons button {
        padding: 6px 8px;
        font-size: 11px;
        flex: 1;
        text-align: center;
      }
      .indicator-buttons {
        width: 100%;
      }
      .indicator-btn {
        padding: 5px 8px;
        font-size: 10px;
      }
      .main-chart {
        height: 250px;
      }
      .sub-chart {
        height: 80px;
      }
      .macd-values {
        gap: 8px;
        font-size: 10px;
      }
      .interval-buttons {
        width: 100%;
        justify-content: flex-start;
      }
      .interval-buttons button {
        padding: 5px 8px;
        font-size: 10px;
      }
    }
  `]
})
export class StockChartComponent implements OnChanges, OnDestroy {
  @Input() symbol = '';
  @ViewChild('mainChartEl', { static: true }) mainChartEl!: ElementRef;
  @ViewChild('rsiChartEl') rsiChartEl!: ElementRef;
  @ViewChild('macdChartEl') macdChartEl!: ElementRef;
  @ViewChild('volumeChartEl') volumeChartEl!: ElementRef;

  ranges = CHART_RANGES;
  activeRange: ChartRange = CHART_RANGES[1];
  activeInterval = signal<string>(CHART_RANGES[1].interval); // '15m'
  indicators = signal<ChartIndicators>({
    ema20: true,
    sma50: true,
    sma200: true,
    bollingerBands: true,
    volume: true,
    rsi: false,
    macd: false
  });

  get intervalOptions() {
    return this.activeRange.intervalOptions ?? [];
  }

  indicatorList = [
    { key: 'ema20' as keyof ChartIndicators, label: 'EMA20' },
    { key: 'sma50' as keyof ChartIndicators, label: 'SMA50' },
    { key: 'sma200' as keyof ChartIndicators, label: 'SMA200' },
    { key: 'bollingerBands' as keyof ChartIndicators, label: 'BB' },
    { key: 'volume' as keyof ChartIndicators, label: 'VOL' },
    { key: 'rsi' as keyof ChartIndicators, label: 'RSI' },
    { key: 'macd' as keyof ChartIndicators, label: 'MACD' }
  ];

  loading = false;
  error = false;
  rsiValue = signal(50);
  macdValue = signal({ macd: 0, signal: 0, histogram: 0 });

  private lastData: any[] = [];
  private regularHours: RegularHours | undefined;
  private mainChart: any = null;
  private rsiChart: any = null;
  private macdChart: any = null;
  private volumeChart: any = null;
  private candleSeries: any = null;
  private bbSeries: any = null;
  private bbUpperSeries: any = null;
  private bbLowerSeries: any = null;
  private volumeSeries: any = null;
  private volumeMaSeries: any = null;
  private charts: any[] = [];
  private resizeObserver: ResizeObserver | null = null;

  constructor(private stockService: StockService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['symbol'] && this.symbol) {
      this.loadChart();
    }
  }

  changeRange(range: ChartRange): void {
    this.activeRange = range;
    this.activeInterval.set(range.interval);
    this.loadChart();
  }

  changeInterval(interval: string): void {
    this.activeInterval.set(interval);
    this.loadChart();
  }

  toggleIndicator(key: keyof ChartIndicators): void {
    this.indicators.update(current => ({
      ...current,
      [key]: !current[key]
    }));
    // Wait for Angular to render/remove conditional @if elements, then re-render
    if (this.lastData.length > 0) {
      setTimeout(() => this.renderCharts(this.lastData), 0);
    }
  }

  private loadChart(): void {
    if (!this.symbol) return;

    this.loading = true;
    this.error = false;

    this.stockService.getChart(this.symbol, this.activeRange.range, this.activeInterval())
      .subscribe({
        next: (response: any) => {
          this.loading = false;
          // Handle both new { data, regularHours } and legacy array format
          const data = Array.isArray(response) ? response : response.data;
          this.regularHours = Array.isArray(response) ? undefined : response.regularHours;
          if (!data || data.length === 0) {
            this.error = true;
            return;
          }
          this.renderCharts(data);
        },
        error: () => {
          this.loading = false;
          this.error = true;
        }
      });
  }

  private destroyCharts(): void {
    this.charts.forEach(c => c?.remove());
    this.charts = [];
    this.mainChart = null;
    this.rsiChart = null;
    this.macdChart = null;
    this.volumeChart = null;
    this.candleSeries = null;
    this.bbSeries = null;
    this.bbUpperSeries = null;
    this.bbLowerSeries = null;
    this.volumeSeries = null;
    this.volumeMaSeries = null;
  }

  private createBaseChart(container: HTMLElement, height: number): any {
    const chart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: height,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#8b949e',
        fontFamily: 'Inter, sans-serif',
        fontSize: 10
      },
      grid: {
        vertLines: { color: 'rgba(48, 54, 61, 0.2)' },
        horzLines: { color: 'rgba(48, 54, 61, 0.2)' }
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: 'rgba(88, 166, 255, 0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(88, 166, 255, 0.3)', width: 1, style: 2 }
      },
      rightPriceScale: { borderColor: 'rgba(48, 54, 61, 0.3)' },
      timeScale: {
        borderColor: 'rgba(48, 54, 61, 0.3)',
        timeVisible: this.activeRange.range === '1d' || this.activeRange.range === '5d'
      },
      handleScroll: { vertTouchDrag: false },
    });
    this.charts.push(chart);
    return chart;
  }

  private renderCharts(data: any[]): void {
    this.destroyCharts();
    this.lastData = data;

    const mainContainer = this.mainChartEl.nativeElement;
    const isMobile = window.innerWidth <= 768;
    this.mainChart = this.createBaseChart(mainContainer, isMobile ? 250 : 350);

    this.candleSeries = this.mainChart.addCandlestickSeries({
      upColor: '#3fb950',
      downColor: '#f85149',
      borderUpColor: '#3fb950',
      borderDownColor: '#f85149',
      wickUpColor: '#3fb950',
      wickDownColor: '#f85149'
    });
    this.candleSeries.setData(data.map(d => {
      const candle: any = {
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close
      };
      if (this.regularHours && !this.isInRegularHours(d.time)) {
        const isUp = d.close >= d.open;
        candle.color = isUp ? 'rgba(63, 185, 80, 0.25)' : 'rgba(248, 81, 73, 0.25)';
        candle.borderColor = isUp ? 'rgba(63, 185, 80, 0.35)' : 'rgba(248, 81, 73, 0.35)';
        candle.wickColor = isUp ? 'rgba(63, 185, 80, 0.35)' : 'rgba(248, 81, 73, 0.35)';
      }
      return candle;
    }));

    this.calculateBollingerBands(data);
    this.calculateAndRenderMAs(data);

    this.mainChart.timeScale().fitContent();

    // Add background shading for extended hours regions
    const extendedRanges = this.computeExtendedRanges(data);
    if (extendedRanges.length > 0) {
      try {
        this.candleSeries.attachPrimitive(this.createSessionShading(extendedRanges));
      } catch (e) {
        console.warn('Session shading (main):', e);
      }
    }

    if (this.indicators().volume && this.volumeChartEl) {
      this.renderVolumeChart(data);
    }
    if (this.indicators().rsi && this.rsiChartEl) {
      this.renderRSIChart(data);
    }
    if (this.indicators().macd && this.macdChartEl) {
      this.renderMACDChart(data);
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(entries => {
      entries.forEach(entry => {
        const width = entry.contentRect.width;
        this.charts.forEach(c => c?.applyOptions({ width }));
      });
    });
    this.resizeObserver.observe(mainContainer);
  }

  private calculateSMA(data: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        sma.push(data[i]);
      } else {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += data[i - j];
        }
        sma.push(sum / period);
      }
    }
    return sma;
  }

  private calculateEMA(data: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    let sum = 0;
    for (let i = 0; i < period && i < data.length; i++) {
      sum += data[i];
    }
    let prevEMA = sum / Math.min(period, data.length);
    ema.push(prevEMA);
    
    for (let i = period; i < data.length; i++) {
      const currentEMA = (data[i] - prevEMA) * multiplier + prevEMA;
      ema.push(currentEMA);
      prevEMA = currentEMA;
    }
    
    return ema;
  }

  private calculateBollingerBands(data: any[]): void {
    if (!this.indicators().bollingerBands || data.length < 20) return;

    const closes = data.map(d => d.close);
    const period = 20;
    const stdDevMult = 2;

    const sma = this.calculateSMA(closes, period);
    
    const bbData: any[] = [];
    const bbUpper: any[] = [];
    const bbLower: any[] = [];

    for (let i = period - 1; i < data.length; i++) {
      let sumSquares = 0;
      for (let j = 0; j < period; j++) {
        sumSquares += Math.pow(closes[i - j] - sma[i], 2);
      }
      const stdDev = Math.sqrt(sumSquares / period);
      
      bbData.push({ time: data[i].time, value: sma[i] });
      bbUpper.push({ time: data[i].time, value: sma[i] + stdDevMult * stdDev });
      bbLower.push({ time: data[i].time, value: sma[i] - stdDevMult * stdDev });
    }

    if (!this.bbSeries) {
      this.bbSeries = this.mainChart.addLineSeries({
        color: 'rgba(139, 92, 246, 0.3)',
        lineWidth: 1,
        crosshairMarkerVisible: false
      });
    }
    this.bbSeries.setData(bbData);

    if (!this.bbUpperSeries) {
      this.bbUpperSeries = this.mainChart.addLineSeries({
        color: 'rgba(139, 92, 246, 0.5)',
        lineWidth: 1,
        lineStyle: 2,
        crosshairMarkerVisible: false
      });
    }
    this.bbUpperSeries.setData(bbUpper);

    if (!this.bbLowerSeries) {
      this.bbLowerSeries = this.mainChart.addLineSeries({
        color: 'rgba(139, 92, 246, 0.5)',
        lineWidth: 1,
        lineStyle: 2,
        crosshairMarkerVisible: false
      });
    }
    this.bbLowerSeries.setData(bbLower);
  }

  private calculateAndRenderMAs(data: any[]): void {
    const closes = data.map(d => d.close);
    const times = data.map(d => d.time);
    const inds = this.indicators();

    if (inds.ema20 && data.length >= 20) {
      const ema20Data = this.calculateEMA(closes, 20);
      const series = this.mainChart.addLineSeries({
        color: '#22d3ee',
        lineWidth: 1,
        title: 'EMA20'
      });
      series.setData(times.map((t, i) => ({ time: t, value: ema20Data[i] || closes[i] })).slice(19));
    }

    if (inds.sma50 && data.length >= 50) {
      const sma50Data = this.calculateSMA(closes, 50);
      const series = this.mainChart.addLineSeries({
        color: '#f59e0b',
        lineWidth: 1,
        title: 'SMA50'
      });
      series.setData(times.map((t, i) => ({ time: t, value: sma50Data[i] || closes[i] })).slice(49));
    }

    if (inds.sma200 && data.length >= 200) {
      const sma200Data = this.calculateSMA(closes, 200);
      const series = this.mainChart.addLineSeries({
        color: '#8b5cf6',
        lineWidth: 1,
        title: 'SMA200'
      });
      series.setData(times.map((t, i) => ({ time: t, value: sma200Data[i] || closes[i] })).slice(199));
    }
  }

  private renderVolumeChart(data: any[]): void {
    const container = this.volumeChartEl.nativeElement;
    const isMobile = window.innerWidth <= 768;
    this.volumeChart = this.createBaseChart(container, isMobile ? 80 : 100);

    this.volumeSeries = this.volumeChart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume'
    });
    this.volumeChart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.1, bottom: 0 }
    });
    this.volumeSeries.setData(data.map(d => {
      const extended = this.regularHours && !this.isInRegularHours(d.time);
      const isUp = d.close >= d.open;
      return {
        time: d.time,
        value: d.volume,
        color: extended
          ? (isUp ? 'rgba(63, 185, 80, 0.15)' : 'rgba(248, 81, 73, 0.15)')
          : (isUp ? 'rgba(63, 185, 80, 0.4)' : 'rgba(248, 81, 73, 0.4)')
      };
    }));

    const volumes = data.map(d => d.volume);
    const volumeMa = this.calculateSMA(volumes, 20);
    this.volumeMaSeries = this.volumeChart.addLineSeries({
      color: '#60a5fa',
      lineWidth: 1
    });
    this.volumeMaSeries.setData(data.map((d, i) => ({
      time: d.time,
      value: volumeMa[i] || volumes[i]
    })));

    this.volumeChart.timeScale().fitContent();

    const extendedRanges = this.computeExtendedRanges(data);
    if (extendedRanges.length > 0) {
      try {
        this.volumeSeries.attachPrimitive(this.createSessionShading(extendedRanges));
      } catch (e) {
        console.warn('Session shading (vol):', e);
      }
    }
  }

  private renderRSIChart(data: any[]): void {
    const container = this.rsiChartEl.nativeElement;
    const isMobile = window.innerWidth <= 768;
    this.rsiChart = this.createBaseChart(container, isMobile ? 80 : 100);

    const closes = data.map(d => d.close);
    const periods = 14;
    const rsiData: number[] = [];

    for (let i = 0; i < closes.length; i++) {
      if (i < periods) {
        rsiData.push(50);
      } else {
        let gains = 0;
        let losses = 0;
        for (let j = 1; j <= periods; j++) {
          const change = closes[i - j + 1] - closes[i - j];
          if (change > 0) gains += change;
          else losses -= change;
        }
        const avgGain = gains / periods;
        const avgLoss = losses / periods;
        if (avgLoss === 0) {
          rsiData.push(100);
        } else {
          const rs = avgGain / avgLoss;
          rsiData.push(100 - (100 / (1 + rs)));
        }
      }
    }

    const lastRSI = rsiData[rsiData.length - 1];
    this.rsiValue.set(lastRSI);

    const rsiSeries = this.rsiChart.addLineSeries({
      color: '#ec4899',
      lineWidth: 1
    });
    rsiSeries.setData(data.map((d, i) => ({ time: d.time, value: rsiData[i] })));

    this.rsiChart.addLineSeries({
      color: 'rgba(248, 81, 73, 0.3)',
      lineWidth: 1,
      lineStyle: 2
    }).setData(data.map(d => ({ time: d.time, value: 70 })));

    this.rsiChart.addLineSeries({
      color: 'rgba(63, 185, 80, 0.3)',
      lineWidth: 1,
      lineStyle: 2
    }).setData(data.map(d => ({ time: d.time, value: 30 })));

    this.rsiChart.addLineSeries({
      color: 'rgba(139, 92, 246, 0.2)',
      lineWidth: 1,
      lineStyle: 2
    }).setData(data.map(d => ({ time: d.time, value: 50 })));

    this.rsiChart.timeScale().fitContent();
  }

  private renderMACDChart(data: any[]): void {
    const container = this.macdChartEl.nativeElement;
    const isMobile = window.innerWidth <= 768;
    this.macdChart = this.createBaseChart(container, isMobile ? 80 : 100);

    const closes = data.map(d => d.close);
    
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    
    const macdLine: number[] = [];
    for (let i = 0; i < closes.length; i++) {
      macdLine.push(ema12[i] - ema26[i]);
    }
    
    const signalLine = this.calculateEMA(macdLine, 9);
    
    const histogram: number[] = [];
    for (let i = 0; i < macdLine.length; i++) {
      histogram.push(macdLine[i] - signalLine[i]);
    }

    const lastIdx = histogram.length - 1;
    this.macdValue.set({
      macd: macdLine[lastIdx] || 0,
      signal: signalLine[lastIdx] || 0,
      histogram: histogram[lastIdx] || 0
    });

    const macdSeries = this.macdChart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 1
    });
    macdSeries.setData(data.map((d, i) => ({ time: d.time, value: macdLine[i] || 0 })).slice(25));

    const signalSeries = this.macdChart.addLineSeries({
      color: '#f97316',
      lineWidth: 1
    });
    signalSeries.setData(data.map((d, i) => ({ time: d.time, value: signalLine[i] || 0 })).slice(33));

    const histSeries = this.macdChart.addHistogramSeries({
      color: '#22c55e'
    });
    histSeries.setData(data.map((d, i) => ({
      time: d.time,
      value: histogram[i] || 0,
      color: (histogram[i] || 0) >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(248, 81, 73, 0.6)'
    })).slice(33));

    this.macdChart.addLineSeries({
      color: 'rgba(139, 92, 246, 0.3)',
      lineWidth: 1,
      lineStyle: 2
    }).setData(data.map(d => ({ time: d.time, value: 0 })));

    this.macdChart.timeScale().fitContent();
  }

  private computeExtendedRanges(data: any[]): { start: number; end: number }[] {
    if (!this.regularHours) return [];
    const ranges: { start: number; end: number }[] = [];
    let rangeStart: number | null = null;

    for (let i = 0; i < data.length; i++) {
      const isExtended = !this.isInRegularHours(data[i].time);
      if (isExtended && rangeStart === null) {
        rangeStart = data[i].time;
      } else if (!isExtended && rangeStart !== null) {
        ranges.push({ start: rangeStart, end: data[i - 1].time });
        rangeStart = null;
      }
    }
    if (rangeStart !== null) {
      ranges.push({ start: rangeStart, end: data[data.length - 1].time });
    }
    return ranges;
  }

  private createSessionShading(ranges: { start: number; end: number }[]): any {
    let chartRef: any = null;
    return {
      attached({ chart }: any) { chartRef = chart; },
      detached() { chartRef = null; },
      paneViews() {
        return [{
          zOrder() { return 'bottom'; },
          renderer() {
            return {
              draw(target: any) {
                target.useMediaCoordinateSpace(({ context, mediaSize }: any) => {
                  const ts = chartRef?.timeScale();
                  if (!ts) return;
                  context.fillStyle = 'rgba(255, 255, 255, 0.04)';
                  for (const range of ranges) {
                    const x1 = ts.timeToCoordinate(range.start as any);
                    const x2 = ts.timeToCoordinate(range.end as any);
                    if (x1 === null || x2 === null) continue;
                    const left = Math.min(x1, x2);
                    const width = Math.abs(x2 - x1) + 8;
                    context.fillRect(left - 4, 0, width, mediaSize.height);
                  }
                });
              }
            };
          }
        }];
      }
    };
  }

  private isInRegularHours(timestamp: number): boolean {
    if (!this.regularHours) return true;
    const { timezone, open, close } = this.regularHours;
    const date = new Date(timestamp * 1000);
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone
    }).formatToParts(date);
    const h = parseInt(parts.find(p => p.type === 'hour')!.value, 10);
    const m = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
    const timeMinutes = h * 60 + m;

    const [openH, openM] = open.split(':').map(Number);
    const [closeH, closeM] = close.split(':').map(Number);
    return timeMinutes >= openH * 60 + openM && timeMinutes < closeH * 60 + closeM;
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.destroyCharts();
  }
}
