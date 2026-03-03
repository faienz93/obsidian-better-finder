import { App, getAllTags, TFile } from "obsidian";
import { SearchIndex } from "./SearchIndex";
import { HintsType } from "src/component/ui/HintBar";
import { i18n } from "src/const";

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

abstract class SearchFilter<TResult> implements SearchStrategyInterface<TResult>, Filterable<TResult>, HintsType {
  abstract readonly label: string;
  abstract readonly desc: string;
  abstract filter(files: TFile[], extracted: TResult, app: App): TFile[]

  abstract extract(query: string): TResult
  abstract removeFrom(query: string): string
}
class TagsFilter extends SearchFilter<string[]> {
  label = '#';
  desc = 'tag';

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

class TodayFilter extends DateFilter {
  readonly label = 'today';
  readonly desc = i18n.today;
}

class ThisWeekFilter extends DateFilter {
  readonly label = 'this week';
  readonly desc = i18n.thisWeek;
}

class ThisMonthFilter extends DateFilter {
  readonly label = 'this month';
  readonly desc = i18n.thisMonth;
}

abstract class FileTypeFilter extends SearchFilter<string[]> {
  abstract readonly label: string;
  abstract readonly desc: string;
  protected abstract pattern: RegExp;
  protected abstract extensions: string[];

  extract(query: string): string[] {
    return this.pattern.test(query.toLowerCase()) ? this.extensions : [];
  }

  removeFrom(query: string): string {
    return query.replace(this.pattern, '').trim();
  }

  filter(files: TFile[], types: string[], _app: App): TFile[] {
    if (types.length === 0) {
      return files.filter(f => f.extension === 'md');
    }

    return files.filter(f => types.some(ext => f.extension === ext.slice(1)));
  }
}

class PdfFilter extends FileTypeFilter {
  readonly label = 'pdf';
  readonly desc = 'PDF';
  protected pattern = /\bpdf\b/gi;
  protected extensions = ['.pdf'];
}

class ImageFilter extends FileTypeFilter {
  readonly label = 'image';
  readonly desc = i18n.images;
  protected pattern = /\b(immagine|image|img|png|jpg|jpeg|gif|webp)\b/gi;
  protected extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
}

class CanvasFilter extends FileTypeFilter {
  readonly label = 'canvas';
  readonly desc = 'canvas';
  protected pattern = /\bcanvas\b/gi;
  protected extensions = ['.canvas'];
}

class JsonFilter extends FileTypeFilter {
  readonly label = 'json';
  readonly desc = 'json';
  protected pattern = /\bjson\b/gi;
  protected extensions = ['.json'];
}

class BaseFilter extends FileTypeFilter {
  readonly label = 'base';
  readonly desc = 'base';
  protected pattern = /\bbase\b/gi;
  protected extensions = ['.base'];
}

// TODO: ScopeFilter non rispetta ISP — extract() restituisce già remainingText,
// quindi removeFrom() è ridondante. Da valutare se separare in futuro.
class TitleFilter extends SearchFilter<{ scope?: 'title' | 'content'; remainingText: string }> {
  readonly label = 'title:';
  readonly desc = i18n.title;
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

class CommandFilter extends SearchFilter<{ isCommandMode: boolean; commandText?: string }> {
  readonly label = '>';
  readonly desc = i18n.commands;

  filter(_files: TFile[], _extracted: { isCommandMode: boolean; commandText?: string; }, _app: App): TFile[] {
    throw new Error("Method not implemented.");
  }
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

class TaskFilter extends SearchFilter<TaskStatus | undefined> {
  readonly label = 'task:';
  readonly desc = 'task';
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
  private readonly strategyMap: Map<string, SearchFilter<unknown>> = new Map();
  private static _instance: SearchStrategyFactory;

  private constructor() {
    // L'ordine definisce l'ordine degli hints nella UI
    this.strategyMap.set('tag', new TagsFilter());
    this.strategyMap.set('today', new TodayFilter());
    this.strategyMap.set('this week', new ThisWeekFilter());
    this.strategyMap.set('this month', new ThisMonthFilter());
    this.strategyMap.set('command', new CommandFilter());
    this.strategyMap.set('title', new TitleFilter());
    this.strategyMap.set('task', new TaskFilter());
    this.strategyMap.set('pdf', new PdfFilter());
    this.strategyMap.set('image', new ImageFilter());
    this.strategyMap.set('canvas', new CanvasFilter());
    this.strategyMap.set('json', new JsonFilter());
    this.strategyMap.set('base', new BaseFilter());
  }

  get hints(): HintsType[] {
    return Array.from(this.strategyMap.values());
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

    // Apply date filter (any of the 3 date strategies share the same logic)
    if (parsed.dateFilter) {
      const strategy = this.strategyMap.get('today');

      if (strategy && isFilterable(strategy)) {
        results = strategy.filter(results, parsed.dateFilter, app);
      }
    }

    // Apply file type filter (always applied - filters to markdown if no types specified)
    const fileTypeStrategy = this.strategyMap.get('pdf') as FileTypeFilter;

    results = fileTypeStrategy.filter(results, parsed.fileTypes, app);

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

    console.log(trimmedInput)
    //const hasHash = trimmedInput.includes("#");

    const strategyWithHash = Array.from(this.strategyMap.values())
      .find(s => trimmedInput.includes(s.label));

    console.log(strategyWithHash)

    //console.log(hasHash)

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
    const dateStrategy = this.getStrategy('today') as DateFilter;

    result.dateFilter = dateStrategy.extract(remainingText);
    remainingText = dateStrategy.removeFrom(remainingText);

    // 4. Extract file type filters (pdf, image, canvas, json, base)
    const fileTypeKeys = ['pdf', 'image', 'canvas', 'json', 'base'];

    for (const key of fileTypeKeys) {
      const strategy = this.getStrategy(key) as FileTypeFilter;

      result.fileTypes.push(...strategy.extract(remainingText));
      remainingText = strategy.removeFrom(remainingText);
    }

    result.fileTypes = [...new Set(result.fileTypes)];

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
