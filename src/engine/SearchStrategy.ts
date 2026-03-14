import { App, TFile } from "obsidian";
import { HintsType } from "src/component/ui/HintBar";
import { SearchIndex } from "./SearchIndex";
import {
  ParsedQuery, SearchFilter, isFilterable,
  TagsFilter, TodayFilter, ThisWeekFilter, ThisMonthFilter,
  FileTypeFilter, PdfFilter, ImageFilter, CanvasFilter, JsonFilter, BaseFilter,
  TitleFilter, CommandFilter, TaskFilter,
} from "./search-filters";

// Re-export per compatibilità con i file che importano da qui
export type { ParsedQuery, DateRange, TaskStatus } from "./search-filters";
export { SearchFilter, isFilterable } from "./search-filters";

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

  async filterFreeText(files: TFile[], parsed: ParsedQuery, app: App): Promise<TFile[]> {
    if (!parsed.freeText) {
      return files.sort((a, b) => b.stat.mtime - a.stat.mtime);
    }

    const searchIndex = SearchIndex.getInstance(app);
    const isMarkdownOnly = parsed.fileTypes.length === 0;

    if (searchIndex.isIndexReady() && isMarkdownOnly) {
      const indexResults = searchIndex.search(parsed.freeText);
      const resultPaths = new Set(files.map(f => f.path));

      return indexResults.filter(f => resultPaths.has(f.path));
    }

    return searchIndex.searchFilesWithoutIndex(parsed.freeText, files);
  }

  parse(input: string): ParsedQuery {
    const trimmedInput = input.trim();

    // TEST non cancellare
    // console.log(trimmedInput)

    // const strategyWithHash = Array.from(this.strategyMap.values())
    //   .find(s => trimmedInput.includes(s.label));

    // console.log(strategyWithHash)

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
    const dateStrategy = this.getStrategy('today') as TodayFilter;

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
