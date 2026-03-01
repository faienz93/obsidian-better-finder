import { App, getAllTags, TFile } from "obsidian";
import { SearchIndex } from "./SearchIndex";

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

export interface SearchStrategyInterface<TResult> {
  extract(query: string): TResult;
  removeFrom(query: string): string;
}

export interface Filterable<TResult> {
  filter(files: TFile[], extracted: TResult, app: App): TFile[];
}

export type DateRange = 'today' | 'this-week' | 'this-month';
export type TaskStatus = 'all' | 'todo' | 'done';

// Type Guards.
export const isFilterable = (strategy: any): strategy is Filterable<unknown> => {
  return typeof strategy.filter === 'function';
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

class DateFilter implements SearchStrategyInterface<DateRange | undefined>, Filterable<DateRange | undefined> {
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

  filter(files: TFile[], dateFilter: DateRange | undefined, app: App): TFile[] {
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
class TitleFilter implements SearchStrategyInterface<{ scope?: 'title' | 'content'; remainingText: string }>, Filterable<{ scope?: 'title' | 'content'; remainingText: string }> {
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

  filter(files: TFile[], extracted: { scope?: "title" | "content"; remainingText: string; }, app: App): TFile[] {
    const searchIndex = SearchIndex.getInstance(app);

    return searchIndex.searchInTitlesWithoutIndex(extracted.remainingText, files);
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

class TaskFilter implements SearchStrategyInterface<TaskStatus | undefined>, Filterable<TaskStatus | undefined> {
  extract(query: string): TaskStatus | undefined {
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

  filter(files: TFile[], taskFilter: TaskStatus | undefined, app: App): TFile[] {
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
    this.strategyMap.set('title', new TitleFilter());
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

  /**
   * Apply all filters from ParsedQuery to a list of files
   * @param files - Files to filter
   * @param parsed - ParsedQuery with extracted filters
   * @param app - Obsidian App instance
   * @returns Filtered files
   */
  filter(files: TFile[], parsed: ParsedQuery, app: App): TFile[] {
    let results = files;

    // Apply tag filter
    if (parsed.tags.length > 0) {
      const strategy = this.strategyMap.get('tag');

      if (strategy && isFilterable(strategy)) {
        results = strategy.filter(results, parsed.tags, app);
      }
    }

    // Apply date filter
    if (parsed.dateFilter) {
      const strategy = this.strategyMap.get('dateFilter');

      if (strategy && isFilterable(strategy)) {
        results = strategy.filter(results, parsed.dateFilter, app);
      }
    }

    // Apply file type filter (always applied - filters to markdown if no types specified)
    const fileStrategy = this.strategyMap.get('fileTypes');

    if (fileStrategy && isFilterable(fileStrategy)) {
      results = fileStrategy.filter(results, parsed.fileTypes, app);
    } else {
      // Fallback: filter to markdown files only if no strategy
      results = results.filter(f => f.extension === 'md');
    }

    // Apply task filter
    if (parsed.taskFilter) {
      const strategy = this.strategyMap.get('task');

      if (strategy && isFilterable(strategy)) {
        results = strategy.filter(results, parsed.taskFilter, app);
      }
    }

    // Apply title filter (scope search)
    if (parsed.scope === 'title') {
      const strategy = this.strategyMap.get('title');

      if (strategy && isFilterable(strategy)) {
        results = strategy.filter(results, { scope: parsed.scope, remainingText: parsed.freeText }, app);
      } else {
        // Fallback: simple basename search
        const searchTerm = parsed.freeText.toLowerCase();

        results = results.filter(f => f.basename.toLowerCase().includes(searchTerm));
      }
    }

    return results;
  }

  /**
   * Apply free text search on an already-filtered list of files.
   * Uses the MiniSearch index when available (markdown-only), falls back to
   * content scan otherwise. When there is no free text, sorts by mtime desc.
   */
  async filterFreeText(files: TFile[], parsed: ParsedQuery, app: App): Promise<TFile[]> {
    if (!parsed.freeText) {
      return files.sort((a, b) => b.stat.mtime - a.stat.mtime);
    }

    const searchIndex = SearchIndex.getInstance(app);
    const isMarkdownOnly = parsed.fileTypes.length === 0;

    if (searchIndex.isIndexReady() && isMarkdownOnly) {
      const indexResults = searchIndex.search(parsed.freeText, 50);
      const resultPaths = new Set(files.map(f => f.path));

      return indexResults.filter(f => resultPaths.has(f.path));
    }

    return searchIndex.searchFilesWithoutIndex(parsed.freeText, files);
  }

  /**
   * Parse user input and extract all filters
   * @param input - Raw search query from user
   * @returns ParsedQuery object with all extracted filters
   */
  parse(input: string): ParsedQuery {
    const trimmedInput = input.trim();

    // Initialize result
    const result: ParsedQuery = {
      rawInput: trimmedInput,
      isCommandMode: false,
      tags: [],
      fileTypes: [],
      freeText: ''
    };

    // 1. Check for command mode (starts with >)
    const commandStrategy = this.getStrategy('command') as CommandFilter;
    const commandResult = commandStrategy.extract(trimmedInput);

    if (commandResult.isCommandMode) {
      result.isCommandMode = true;
      result.commandText = commandResult.commandText;

      return result;
    }

    let remainingText = trimmedInput;

    // 2. Extract tags (#react #css)
    const tagStrategy = this.getStrategy('tag') as TagsFilter;

    result.tags = tagStrategy.extract(remainingText);
    remainingText = tagStrategy.removeFrom(remainingText);

    // 3. Extract date filters (today, this week, this month)
    const dateStrategy = this.getStrategy('dateFilter') as DateFilter;

    result.dateFilter = dateStrategy.extract(remainingText);
    remainingText = dateStrategy.removeFrom(remainingText);

    // 4. Extract file type filters (PDF, immagine, Word, Excel)
    const fileStrategy = this.getStrategy('fileTypes') as FileFilter;

    result.fileTypes = fileStrategy.extract(remainingText);
    remainingText = fileStrategy.removeFrom(remainingText);

    // 5. Extract scope (title:something)
    const titleStrategy = this.getStrategy('title') as TitleFilter;
    const scopeResult = titleStrategy.extract(remainingText);

    result.scope = scopeResult.scope;
    remainingText = titleStrategy.removeFrom(remainingText);

    // 6. Extract task filters (task:, task-todo:, task-done:)
    const taskStrategy = this.getStrategy('task') as TaskFilter;

    result.taskFilter = taskStrategy.extract(remainingText);
    remainingText = taskStrategy.removeFrom(remainingText);

    // 7. What's left is free text
    result.freeText = remainingText.trim();

    return result;
  }
}
