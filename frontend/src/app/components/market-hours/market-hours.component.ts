import { Component, OnInit, OnDestroy, signal } from '@angular/core';

interface ExchangeDef {
  name: string;
  timezone: string;
  openHour: number;
  openMinute: number;
  closeHour: number;
  closeMinute: number;
  holidays: (year: number, easter: Date) => string[];
}

interface ExchangeStatus {
  name: string;
  timezone: string;
  openHour: number;
  openMinute: number;
  closeHour: number;
  closeMinute: number;
  isOpen: boolean;
  label: string;
  localTime: string;
}

@Component({
  selector: 'app-market-hours',
  standalone: true,
  template: `
    <div class="market-hours">
      @for (ex of exchanges(); track ex.name) {
        <div class="exchange" [class.open]="ex.isOpen" [class.closed]="!ex.isOpen">
          <span class="dot"></span>
          <span class="name">{{ ex.name }}</span>
          <span class="detail">{{ ex.label }}</span>
          <span class="time">{{ ex.localTime }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .market-hours {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .exchange {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      white-space: nowrap;
    }
    .exchange.open {
      background: rgba(63, 185, 80, 0.1);
      color: var(--green);
    }
    .exchange.closed {
      background: rgba(139, 148, 158, 0.1);
      color: var(--text-secondary);
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .exchange.open .dot {
      background: var(--green);
      box-shadow: 0 0 4px var(--green);
    }
    .exchange.closed .dot {
      background: var(--text-muted);
    }
    .name {
      font-weight: 600;
    }
    .detail {
      color: inherit;
      opacity: 0.85;
    }
    .time {
      opacity: 0.6;
      font-size: 11px;
    }
    @media (max-width: 768px) {
      .market-hours {
        gap: 6px;
      }
      .exchange {
        padding: 3px 7px;
        font-size: 10px;
        gap: 4px;
      }
      .detail {
        display: none;
      }
      .time {
        font-size: 10px;
      }
    }
  `]
})
export class MarketHoursComponent implements OnInit, OnDestroy {
  exchanges = signal<ExchangeStatus[]>([]);
  private timer?: ReturnType<typeof setInterval>;
  private holidayCache = new Map<string, Set<string>>();

  private readonly exchangeDefs: ExchangeDef[] = [
    {
      name: 'NASDAQ',
      timezone: 'America/New_York',
      openHour: 9, openMinute: 30,
      closeHour: 16, closeMinute: 0,
      holidays: (year, easter) => [
        `${year}-01-01`,  // New Year's Day
        this.nthWeekday(year, 1, 1, 3),   // MLK Day: 3rd Monday in January
        this.nthWeekday(year, 2, 1, 3),   // Presidents' Day: 3rd Monday in February
        this.offsetDate(easter, -2),       // Good Friday
        this.nthWeekday(year, 5, 1, -1),  // Memorial Day: last Monday in May
        `${year}-06-19`,  // Juneteenth
        `${year}-07-04`,  // Independence Day
        this.nthWeekday(year, 9, 1, 1),   // Labor Day: 1st Monday in September
        this.nthWeekday(year, 11, 4, 4),  // Thanksgiving: 4th Thursday in November
        `${year}-12-25`,  // Christmas Day
      ]
    },
    {
      name: 'Copenhagen',
      timezone: 'Europe/Copenhagen',
      openHour: 9, openMinute: 0,
      closeHour: 17, closeMinute: 0,
      holidays: (year, easter) => [
        `${year}-01-01`,  // New Year's Day
        this.offsetDate(easter, -3),  // Maundy Thursday
        this.offsetDate(easter, -2),  // Good Friday
        this.offsetDate(easter, 1),   // Easter Monday
        this.offsetDate(easter, 26),  // General Prayer Day (Store Bededag) — still observed by exchange
        this.offsetDate(easter, 39),  // Ascension Day
        this.offsetDate(easter, 50),  // Whit Monday
        `${year}-06-05`,  // Constitution Day
        `${year}-12-24`,  // Christmas Eve
        `${year}-12-25`,  // Christmas Day
        `${year}-12-26`,  // 2nd Christmas Day
        `${year}-12-31`,  // New Year's Eve
      ]
    },
  ];

  ngOnInit(): void {
    this.update();
    this.timer = setInterval(() => this.update(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private update(): void {
    const now = new Date();
    this.exchanges.set(this.exchangeDefs.map(def => this.computeStatus(now, def)));
  }

  private computeStatus(now: Date, def: ExchangeDef): ExchangeStatus {
    const parts = this.getTimeParts(now, def.timezone);
    const { hour, minute, dayOfWeek, year, month, day } = parts;
    const nowMinutes = hour * 60 + minute;
    const openMinutes = def.openHour * 60 + def.openMinute;
    const closeMinutes = def.closeHour * 60 + def.closeMinute;

    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isHoliday = this.getHolidays(def, year).has(dateStr);
    const isTradingDay = isWeekday && !isHoliday;
    const isOpen = isTradingDay && nowMinutes >= openMinutes && nowMinutes < closeMinutes;

    let label: string;
    if (isOpen) {
      const remaining = closeMinutes - nowMinutes;
      label = `${this.formatDuration(remaining)} left`;
    } else {
      const minutesUntilOpen = this.getMinutesUntilOpen(parts, def);
      if (isHoliday && isWeekday) {
        label = `Holiday \u00b7 opens ${this.formatDuration(minutesUntilOpen)}`;
      } else {
        label = `opens ${this.formatDuration(minutesUntilOpen)}`;
      }
    }

    const localTime = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: def.timezone,
      hour12: false
    }).format(now);

    const tzAbbr = this.getTimezoneAbbr(now, def.timezone);

    return {
      name: def.name,
      timezone: def.timezone,
      openHour: def.openHour,
      openMinute: def.openMinute,
      closeHour: def.closeHour,
      closeMinute: def.closeMinute,
      isOpen,
      label,
      localTime: `${localTime} ${tzAbbr}`
    };
  }

  private getTimeParts(now: Date, timezone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
    const hour = parseInt(get('hour'));
    const weekdayStr = parts.find(p => p.type === 'weekday')?.value || 'Mon';
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      hour: hour === 24 ? 0 : hour,
      minute: parseInt(get('minute')),
      dayOfWeek: dayMap[weekdayStr] ?? 1,
      year: parseInt(get('year')),
      month: parseInt(get('month')),
      day: parseInt(get('day'))
    };
  }

  private getMinutesUntilOpen(
    parts: { hour: number; minute: number; dayOfWeek: number; year: number; month: number; day: number },
    def: ExchangeDef
  ): number {
    const nowMinutes = parts.hour * 60 + parts.minute;
    const openMinutes = def.openHour * 60 + def.openMinute;
    const dateStr = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    const isWeekday = parts.dayOfWeek >= 1 && parts.dayOfWeek <= 5;
    const isHoliday = this.getHolidays(def, parts.year).has(dateStr);

    // If it's a trading day and before open
    if (isWeekday && !isHoliday && nowMinutes < openMinutes) {
      return openMinutes - nowMinutes;
    }

    // Count forward to next trading day
    const remainingToday = 24 * 60 - nowMinutes;
    let daysAhead = 0;
    let nextDay = parts.dayOfWeek;
    let checkDate = new Date(parts.year, parts.month - 1, parts.day);

    do {
      daysAhead++;
      nextDay = (nextDay + 1) % 7;
      checkDate = new Date(parts.year, parts.month - 1, parts.day + daysAhead);
      const y = checkDate.getFullYear();
      const m = checkDate.getMonth() + 1;
      const d = checkDate.getDate();
      const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isWd = nextDay >= 1 && nextDay <= 5;
      if (isWd && !this.getHolidays(def, y).has(ds)) break;
    } while (daysAhead < 10); // safety limit

    return remainingToday + (daysAhead - 1) * 24 * 60 + openMinutes;
  }

  // --- Holiday computation ---

  private getHolidays(def: ExchangeDef, year: number): Set<string> {
    const key = `${def.name}-${year}`;
    if (!this.holidayCache.has(key)) {
      const easter = this.computeEaster(year);
      this.holidayCache.set(key, new Set(def.holidays(year, easter)));
    }
    return this.holidayCache.get(key)!;
  }

  /** Anonymous Gregorian Easter algorithm (Computus) */
  private computeEaster(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  /** Offset a date by N days and return 'YYYY-MM-DD' */
  private offsetDate(base: Date, days: number): string {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Find the Nth weekday of a month (negative N counts from end) */
  private nthWeekday(year: number, month: number, weekday: number, n: number): string {
    if (n > 0) {
      const first = new Date(year, month - 1, 1);
      let diff = (weekday - first.getDay() + 7) % 7;
      const day = 1 + diff + (n - 1) * 7;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else {
      // Last occurrence: start from end of month
      const last = new Date(year, month, 0); // last day of month
      let diff = (last.getDay() - weekday + 7) % 7;
      const day = last.getDate() - diff;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  private formatDuration(minutes: number): string {
    if (minutes < 1) return '<1m';
    const d = Math.floor(minutes / (24 * 60));
    const h = Math.floor((minutes % (24 * 60)) / 60);
    const m = minutes % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
  }

  private getTimezoneAbbr(date: Date, timezone: string): string {
    const str = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    }).format(date);
    const parts = str.split(' ');
    return parts[parts.length - 1];
  }
}
