import { App, TFile } from "obsidian";
import { i18n } from "src/const";
import { DateRange, DateValue, SearchFilter } from "./types";

function parseAbsoluteDate(value: string): Date | null {
  // Supporta YYYY-MM-DD e YYYY/MM/DD
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
      const absDate = parseAbsoluteDate(value);

      if (!absDate) return null;

      const end = new Date(absDate);

      end.setDate(end.getDate() + 1);

      return { start: absDate, end };
    }
  }
}

abstract class DateFilter extends SearchFilter<DateRange | undefined> {
  protected abstract readonly field: 'created' | 'modified';

  extract(query: string): DateRange | undefined {
    const pattern = new RegExp(`\\b${this.field}:(\\S+)`, 'i');
    const match = pattern.exec(query);

    if (!match) return undefined;

    return { field: this.field, value: match[1] };
  }

  removeFrom(query: string): string {
    return query.replace(new RegExp(`\\b${this.field}:\\S+`, 'gi'), '').trim();
  }

  filter(files: TFile[], dateRange: DateRange | undefined, _app: App): TFile[] {
    if (!dateRange) return files;

    const range = getDateRange(dateRange.value);

    if (!range) return files;

    const { start, end } = range;
    const statField = this.field === 'created' ? 'ctime' : 'mtime';

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
  protected readonly field = 'modified' as const;
}

export class CreatedFilter extends DateFilter {
  readonly label = 'created:';
  readonly desc = i18n.created;
  protected readonly field = 'created' as const;
}
