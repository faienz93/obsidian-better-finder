export interface SearchStrategyInterface<TResult> {
  extract(query: string): TResult;
  removeFrom(query: string): string;
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

class TagsFilter implements SearchStrategyInterface<string[]> {
  extract(query: string) {
    const tagRegex = /#([a-zA-Z0-9][\w\-/]*)/g;
    const matches = query.match(tagRegex);

    return matches ? matches.map(tag => tag.toLowerCase()) : [];
  }

  removeFrom(query: string) {
    return query.replace(/#([a-zA-Z0-9][\w\-/]*)/g, '').trim();
  }
}

class DateFilter implements SearchStrategyInterface<'today' | 'this-week' | 'this-month' | undefined> {
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

class FileFilter implements SearchStrategyInterface<string[]> {
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

class TaskFilter implements SearchStrategyInterface<'all' | 'todo' | 'done' | undefined> {
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
}

export class SearchStrategyFactory {
  private readonly strategyMap: Map<string, SearchStrategyInterface<unknown>> = new Map();
  private static _instance: SearchStrategyFactory;

  private constructor() {
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

    if (trimmedInput.startsWith('>')) {
      result.isCommandMode = true;
      result.commandText = trimmedInput.slice(1).trim();

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
