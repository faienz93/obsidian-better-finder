import { App, TFile } from "obsidian";
import { i18n } from "src/const";
import { DateRange, SearchFilter } from "./types";

abstract class DateFilter extends SearchFilter<DateRange | undefined> {
  extract(query: string): DateRange | undefined {
    const lowerQuery = query.toLowerCase();

    if (/\btoday\b/.test(lowerQuery)) return 'today';
    if (/\bthis week\b/.test(lowerQuery)) return 'this-week';
    if (/\bthis month\b/.test(lowerQuery)) return 'this-month';

    return undefined;
  }

  removeFrom(query: string): string {
    return query
      .replace(/\btoday\b/gi, '')
      .replace(/\bthis week\b/gi, '')
      .replace(/\bthis month\b/gi, '')
      .trim();
  }

  filter(files: TFile[], dateFilter: DateRange | undefined, _app: App): TFile[] {
    if (!dateFilter) return files;

    return files.filter(file => {
      const fileDate = new Date(file.stat.mtime);

      switch (dateFilter) {
        case 'today': return this.isToday(fileDate);
        case 'this-week': return this.isThisWeek(fileDate);
        case 'this-month': return this.isThisMonth(fileDate);
        default: return true;
      }
    });
  }

  private isToday(date: Date): boolean {
    const today = new Date();

    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  }

  private isThisWeek(date: Date): boolean {
    const today = new Date();
    const weekStart = new Date(today);

    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);

    weekEnd.setDate(weekStart.getDate() + 7);

    return date >= weekStart && date < weekEnd;
  }

  private isThisMonth(date: Date): boolean {
    const today = new Date();

    return date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  }
}

export class TodayFilter extends DateFilter {
  readonly label = 'today';
  readonly desc = i18n.today;
}

export class ThisWeekFilter extends DateFilter {
  readonly label = 'this week';
  readonly desc = i18n.thisWeek;
}

export class ThisMonthFilter extends DateFilter {
  readonly label = 'this month';
  readonly desc = i18n.thisMonth;
}
