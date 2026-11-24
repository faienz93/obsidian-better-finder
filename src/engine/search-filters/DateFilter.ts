import { App, TFile } from "obsidian";
import { i18n } from "src/const";
import { DateField, DateRange, DateValue, QueryToken, SearchFilter } from "./types";

// Supported relative values: the single source of truth, also used by the sub-hint bar.
export const DATE_VALUES = ['today', 'yesterday', 'this-week', 'last-week', 'this-month', 'last-month'] as const;

// Recognised date values: relative keywords, YYYY-MM-DD / YYYY/MM/DD, YYYY.
export const DATE_VALUE_PATTERN = `(?:${DATE_VALUES.join('|')}|\\d{4}[-/]\\d{2}[-/]\\d{2}|\\d{4})`;

/** Reads YYYY-MM-DD and YYYY/MM/DD. */
function parseAbsoluteDate(value: string): Date | null {
  const match = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(value);

  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  return isNaN(date.getTime()) ? null : date;
}

function getDateRange(value: DateValue): { start: Date; end: Date } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (value) {
    case 'today': {
      const end = new Date(today);

      end.setDate(end.getDate() + 1);

      return { start: today, end };
    }

    case 'yesterday': {
      const start = new Date(today);

      start.setDate(start.getDate() - 1);

      return { start, end: today };
    }

    case 'this-week': {
      const start = new Date(today);

      start.setDate(today.getDate() - today.getDay());

      const end = new Date(start);

      end.setDate(start.getDate() + 7);

      return { start, end };
    }

    case 'last-week': {
      const start = new Date(today);

      start.setDate(today.getDate() - today.getDay() - 7);

      const end = new Date(start);

      end.setDate(start.getDate() + 7);

      return { start, end };
    }

    case 'this-month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      return { start, end };
    }

    case 'last-month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 1);

      return { start, end };
    }

    default: {
      // A bare year (e.g. "2026") covers the whole calendar year.
      const yearMatch = /^(\d{4})$/.exec(value);

      if (yearMatch) {
        const year = Number(yearMatch[1]);

        return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
      }

      const absDate = parseAbsoluteDate(value);

      if (!absDate) return null;

      const end = new Date(absDate);

      end.setDate(end.getDate() + 1);

      return { start: absDate, end };
    }
  }
}

const DATE_VALUE = new RegExp(`^${DATE_VALUE_PATTERN}$`, 'i');

abstract class DateFilter extends SearchFilter<'dateFilter'> {
  readonly field = 'dateFilter';
  readonly takesValue = true;
  protected abstract readonly dateField: DateField;

  /** Only a date is read, so `created: banana` leaves "banana" in the free text. */
  accepts(value: string): boolean {
    return DATE_VALUE.test(value);
  }

  /** The first date wins, except that modified always wins over created. */
  read(token: QueryToken, current: DateRange | undefined): DateRange | undefined {
    const next: DateRange = { field: this.dateField, value: token.value.toLowerCase() };

    if (!current || (current.field === 'created' && next.field === 'modified')) return next;

    return current;
  }

  filter(files: TFile[], dateRange: DateRange | undefined, _app: App): TFile[] {
    if (!dateRange || dateRange.field !== this.dateField) return files;

    const range = getDateRange(dateRange.value);

    if (!range) return files;

    const { start, end } = range;
    const statField = this.dateField === 'created' ? 'ctime' : 'mtime';

    return files
      .filter(file => {
        const ts = file.stat[statField];

        return ts >= start.getTime() && ts < end.getTime();
      })
      .sort((a, b) => b.stat[statField] - a.stat[statField]);
  }
}

export class ModifiedFilter extends DateFilter {
  readonly label = 'modified:';
  readonly desc = i18n.modified;
  protected readonly dateField = 'modified' as const;
  readonly keys = ['modified'];
}

export class CreatedFilter extends DateFilter {
  readonly label = 'created:';
  readonly desc = i18n.created;
  protected readonly dateField = 'created' as const;
  readonly keys = ['created'];
}
