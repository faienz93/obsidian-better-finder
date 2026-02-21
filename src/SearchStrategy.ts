export interface SearchStrategyInterface<TResult> {
  extract(query: string): TResult;
  removeFrom(query: string): string;
}

export interface Filterable<TResult> {
  filter(files: TFile[], extracted: TResult, app: App): TFile[];
}

export interface ParsedQuery {
  rawInput: string;
  isCommandMode: boolean;
  commandText?: string;
  tags: string[];
  dateFilter?: 'today' | 'this-week' | 'this-month';
  fileTypes: string[];
  scope?: 'title' | 'content';
  taskFilter?: 'all' | 'todo' | 'done';
  freeText: string;
}

class TagsFilter implements SearchStrategyInterface<string[]>, Filterable<string[]> {
  extract(query: string) {
    const tagRegex = /#([a-zA-Z0-9][\w\-/]*)/g;
    const matches = query.match(tagRegex);

    return matches ? matches.map(tag => tag.toLowerCase()) : [];
  }

  removeFrom(query: string) {
    return query.replace(/#([a-zA-Z0-9][\w\-/]*)/g, '').trim();
  }

  filter(files: TFile[], tags: string[], app: App): TFile[] {
    if (tags.length === 0) return files;

    return files.filter(file => {
      const cache = app.metadataCache.getFileCache(file);

      if (!cache) return false;
      const fileTags = getAllTags(cache) || [];

      return tags.every(tag => fileTags.includes(tag));
    });
  }
}

class DateFilter implements SearchStrategyInterface<'today' | 'this-week' | 'this-month' | undefined>, Filterable<'today' | 'this-week' | 'this-month' | undefined> {
  extract(query: string): 'today' | 'this-week' | 'this-month' | undefined {
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

  filter(files: TFile[], dateFilter: 'today' | 'this-week' | 'this-month' | undefined, app: App): TFile[] {
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

  isToday(date: Date): boolean {
    const today = new Date();

    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  }

  isThisWeek(date: Date): boolean {
    const today = new Date();
    const weekStart = new Date(today);

    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);

    weekEnd.setDate(weekStart.getDate() + 7);

    return date >= weekStart && date < weekEnd;
  }

  isThisMonth(date: Date): boolean {
    const today = new Date();

    return date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  }
}

class FileFilter implements SearchStrategyInterface<string[]>, Filterable<string[]> {
  extract(query: string): string[] {
    const types: string[] = [];
    const lowerQuery = query.toLowerCase();

    if (/\b(immagine|image|img|png|jpg|jpeg|gif|webp)\b/.test(lowerQuery)) {
      types.push('.png', '.jpg', '.jpeg', '.gif', '.webp');
    }

    if (/\bpdf\b/.test(lowerQuery)) types.push('.pdf');
    if (/\b(word|docx|doc)\b/.test(lowerQuery)) types.push('.docx', '.doc');
    if (/\b(excel|xlsx|xls)\b/.test(lowerQuery)) types.push('.xlsx', '.xls');
    if (/\bcanvas\b/.test(lowerQuery)) types.push('.canvas');
    if (/\bjson\b/.test(lowerQuery)) types.push('.json');
    if (/\bbase\b/.test(lowerQuery)) types.push('.base');

    return [...new Set(types)];
  }

  removeFrom(query: string): string {
    return query
      .replace(/\b(immagine|image|img|png|jpg|jpeg|gif|webp)\b/gi, '')
      .replace(/\bpdf\b/gi, '')
      .replace(/\b(word|docx|doc)\b/gi, '')
      .replace(/\b(excel|xlsx|xls)\b/gi, '')
      .replace(/\bcanvas\b/gi, '')
      .replace(/\bjson\b/gi, '')
      .replace(/\bbase\b/gi, '')
      .trim();
  }

  filter(files: TFile[], fileTypes: string[], app: App): TFile[] {
    if (fileTypes.length === 0) {
      return files.filter(f => f.extension === 'md');
    }

    return files.filter(f => fileTypes.some(ext => f.extension === ext.slice(1)));
  }
}

// TODO: ScopeFilter non rispetta ISP — extract() restituisce già remainingText,
// quindi removeFrom() è ridondante. Da valutare se separare in futuro.
class ScopeFilter implements SearchStrategyInterface<{ scope?: 'title' | 'content'; remainingText: string }> {
  extract(query: string): { scope?: 'title' | 'content'; remainingText: string } {
    const titleMatch = query.match(/\btitle:\s*(\S+)/i);

    if (titleMatch) {
      const searchTerm = titleMatch[1];
      const remainingText = query.replace(/\btitle:\s*\S+/i, searchTerm).trim();

      return { scope: 'title', remainingText };
    }

    return { scope: undefined, remainingText: query };
  }

  // Rimuove il prefisso "title:" mantenendo il termine di ricerca come testo libero
  removeFrom(query: string): string {
    return query.replace(/\btitle:\s*/i, '').trim();
  }
}

class CommandFilter implements SearchStrategyInterface<{ isCommandMode: boolean; commandText?: string }> {
  extract(query: string): { isCommandMode: boolean; commandText?: string } {
    const trimmed = query.trim();

    if (trimmed.startsWith('>')) {
      return { isCommandMode: true, commandText: trimmed.slice(1).trim() };
    }

    return { isCommandMode: false };
  }

  removeFrom(query: string): string {
    return query.replace(/^>\s*/, '').trim();
  }
}

class TaskFilter implements SearchStrategyInterface<'all' | 'todo' | 'done' | undefined>, Filterable<'all' | 'todo' | 'done' | undefined> {
  extract(query: string): 'all' | 'todo' | 'done' | undefined {
    const lowerQuery = query.toLowerCase();

    if (/\btask-todo:\b/.test(lowerQuery)) return 'todo';
    if (/\btask-done:\b/.test(lowerQuery)) return 'done';
    if (/\btask:\b/.test(lowerQuery)) return 'all';

    return undefined;
  }

  removeFrom(query: string): string {
    return query
      .replace(/\btask-todo:\b/gi, '')
      .replace(/\btask-done:\b/gi, '')
      .replace(/\btask:\b/gi, '')
      .trim();
  }

  filter(files: TFile[], taskFilter: 'all' | 'todo' | 'done' | undefined, app: App): TFile[] {
    if (!taskFilter) return files;

    return files.filter(file => {
      if (file.extension !== 'md') return false;
      const cache = app.metadataCache.getFileCache(file);

      if (!cache?.listItems) return false;
      const tasks = cache.listItems.filter(item => item.task);

      if (tasks.length === 0) return false;

      switch (taskFilter) {
        case 'all': return true;
        case 'todo': return tasks.some(t => t.task !== 'x' && t.task !== 'X');
        case 'done': return tasks.some(t => t.task === 'x' || t.task === 'X');
        default: return true;
      }
    });
  }
}

export class SearchStrategyFactory {
  private readonly strategyMap: Map<string, SearchStrategyInterface<unknown>> = new Map();
  private static _instance: SearchStrategyFactory;

  private constructor() {
    this.strategyMap.set('command', new CommandFilter());
    this.strategyMap.set('tag', new TagsFilter());
    this.strategyMap.set('dateFilter', new DateFilter());
    this.strategyMap.set('fileTypes', new FileFilter());
    this.strategyMap.set('title', new ScopeFilter());
    this.strategyMap.set('task', new TaskFilter());
  }

  public static getInstance(): SearchStrategyFactory {
    if (!SearchStrategyFactory._instance) {
      SearchStrategyFactory._instance = new SearchStrategyFactory();
    }

    return SearchStrategyFactory._instance;
  }

  public getStrategy(strategyType: string) {
    const strategy = this.strategyMap.get(strategyType);

    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyType}`);
    }

    return strategy;
  }

  public parse(input: string): ParsedQuery {
    const trimmedInput = input.trim();

    const result: ParsedQuery = {
      rawInput: trimmedInput,
      isCommandMode: false,
      tags: [],
      fileTypes: [],
      freeText: ''
    };

    const commandResult = this.getStrategy('command').extract(trimmedInput) as { isCommandMode: boolean; commandText?: string };

    if (commandResult.isCommandMode) {
      result.isCommandMode = true;
      result.commandText = commandResult.commandText;

      return result;
    }

    let remainingText = trimmedInput;

    result.tags = this.getStrategy('tag').extract(remainingText) as string[];
    remainingText = this.getStrategy('tag').removeFrom(remainingText);

    result.dateFilter = this.getStrategy('dateFilter').extract(remainingText) as ParsedQuery['dateFilter'];
    remainingText = this.getStrategy('dateFilter').removeFrom(remainingText);

    result.fileTypes = this.getStrategy('fileTypes').extract(remainingText) as string[];
    remainingText = this.getStrategy('fileTypes').removeFrom(remainingText);

    const scopeResult = this.getStrategy('title').extract(remainingText) as { scope?: 'title' | 'content'; remainingText: string };

    result.scope = scopeResult.scope;
    remainingText = scopeResult.remainingText;

    result.taskFilter = this.getStrategy('task').extract(remainingText) as ParsedQuery['taskFilter'];
    remainingText = this.getStrategy('task').removeFrom(remainingText);

    result.freeText = remainingText.trim();

    return result;
  }
}
