import { Component, OnInit, OnDestroy, signal } from '@angular/core';

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

  private readonly exchangeDefs = [
    { name: 'NASDAQ', timezone: 'America/New_York', openHour: 9, openMinute: 30, closeHour: 16, closeMinute: 0 },
    { name: 'Copenhagen', timezone: 'Europe/Copenhagen', openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 0 },
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

  private computeStatus(now: Date, def: typeof this.exchangeDefs[0]): ExchangeStatus {
    const parts = this.getTimeParts(now, def.timezone);
    const dayOfWeek = parts.dayOfWeek;
    const nowMinutes = parts.hour * 60 + parts.minute;
    const openMinutes = def.openHour * 60 + def.openMinute;
    const closeMinutes = def.closeHour * 60 + def.closeMinute;

    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isOpen = isWeekday && nowMinutes >= openMinutes && nowMinutes < closeMinutes;

    let label: string;
    if (isOpen) {
      const remaining = closeMinutes - nowMinutes;
      label = `${this.formatDuration(remaining)} left`;
    } else {
      const minutesUntilOpen = this.getMinutesUntilOpen(parts, def);
      label = `opens ${this.formatDuration(minutesUntilOpen)}`;
    }

    const localTime = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: def.timezone,
      hour12: false
    }).format(now);

    const tzAbbr = this.getTimezoneAbbr(now, def.timezone);

    return {
      ...def,
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
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const weekdayStr = parts.find(p => p.type === 'weekday')?.value || 'Mon';
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { hour: hour === 24 ? 0 : hour, minute, dayOfWeek: dayMap[weekdayStr] ?? 1 };
  }

  private getMinutesUntilOpen(
    parts: { hour: number; minute: number; dayOfWeek: number },
    def: typeof this.exchangeDefs[0]
  ): number {
    const nowMinutes = parts.hour * 60 + parts.minute;
    const openMinutes = def.openHour * 60 + def.openMinute;
    let day = parts.dayOfWeek;

    if (day >= 1 && day <= 5 && nowMinutes < openMinutes) {
      return openMinutes - nowMinutes;
    }

    const remainingToday = 24 * 60 - nowMinutes;
    let daysAhead = 0;
    let nextDay = day;

    do {
      daysAhead++;
      nextDay = (nextDay + 1) % 7;
    } while (nextDay === 0 || nextDay === 6);

    return remainingToday + (daysAhead - 1) * 24 * 60 + openMinutes;
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
