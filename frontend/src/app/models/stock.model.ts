export interface StockQuote {
  symbol: string;
  shortName: string;
  currency: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  averageDailyVolume3Month: number;
  regularMarketPreviousClose: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  marketCap: number;
  trailingPE: number;
  marketState: string; // 'PRE' | 'REGULAR' | 'POST' | 'CLOSED'
  preMarketPrice: number | null;
  preMarketChange: number | null;
  preMarketChangePercent: number | null;
  postMarketPrice: number | null;
  postMarketChange: number | null;
  postMarketChangePercent: number | null;
  beta: number | null;
  dividendYield: number | null;
  epsTrailingTwelveMonths: number | null;
  epsForward: number | null;
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  fiftyDayAverageChangePercent: number | null;
  twoHundredDayAverageChangePercent: number | null;
  analystTargetPrice: number | null;
  recommendationKey: string | null;
  numberOfAnalystRatings: number | null;
}

export interface ChartDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RegularHours {
  timezone: string;
  open: string;  // "HH:MM"
  close: string; // "HH:MM"
}

export interface ChartResponse {
  data: ChartDataPoint[];
  regularHours?: RegularHours;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export interface ChartRange {
  label: string;
  range: string;
  interval: string;
}

export const CHART_RANGES: ChartRange[] = [
  { label: '1D', range: '1d', interval: '5m' },
  { label: '5D', range: '5d', interval: '15m' },
  { label: '1M', range: '1mo', interval: '1d' },
  { label: '3M', range: '3mo', interval: '1d' },
  { label: '1Y', range: '1y', interval: '1wk' },
  { label: '5Y', range: '5y', interval: '1mo' }
];

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  guid: string;
  symbols?: string[];
}
