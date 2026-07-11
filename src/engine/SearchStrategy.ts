import { App, TFile } from "obsidian";
import { HintsType } from "src/component/ui/HintBar";
import { SearchIndex } from "./SearchIndex";
import {
  ParsedQuery, SearchFilter, isFilterable,
  TagsFilter, ModifiedFilter, CreatedFilter,
  FileTypeFilter, PdfFilter, ImageFilter, CanvasFilter, JsonFilter, BaseFilter,
  TitleFilter, CommandFilter, TaskFilter, PathFilter, ExcalidrawFilter, HighlightFilter,
  NegationFilter, MetadataFilter,
} from "./search-filters";

// Re-export per compatibilità con i file che importano da qui
export type { ParsedQuery, DateRange, TaskStatus } from "./search-filters";
export { SearchFilter, isFilterable } from "./search-filters";

export class SearchStrategyFactory {
  private readonly strategyMap: Map<string, SearchFilter<unknown>> = new Map();
  private readonly highlightFilter = new HighlightFilter();
  private static _instance: SearchStrategyFactory;

  private constructor() {
    // L'ordine definisce l'ordine degli hints nella UI
    this.strategyMap.set('tag', new TagsFilter());
    this.strategyMap.set('created', new CreatedFilter());
    this.strategyMap.set('modified', new ModifiedFilter());
    this.strategyMap.set('command', new CommandFilter());
    this.strategyMap.set('title', new TitleFilter());
    this.strategyMap.set('task', new TaskFilter());
    this.strategyMap.set('pdf', new PdfFilter());
    this.strategyMap.set('image', new ImageFilter());
    this.strategyMap.set('canvas', new CanvasFilter());
    this.strategyMap.set('json', new JsonFilter());
    this.strategyMap.set('base', new BaseFilter());
    this.strategyMap.set('path', new PathFilter());
    this.strategyMap.set('excalidraw', new ExcalidrawFilter());
    this.strategyMap.set('not', new NegationFilter());
    this.strategyMap.set('meta', new MetadataFilter());
  }

  get hints(): HintsType[] {
    return [...Array.from(this.strategyMap.values()), this.highlightFilter];
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

    // Tag speciale #archive: gli archiviati sono fuori dai risultati di default
    const archiveStrategy = this.strategyMap.get('tag') as TagsFilter;

    results = archiveStrategy.excludeArchived(results, parsed.tags, app);

    // Apply tag filter
    if (parsed.tags.length > 0) {
      const strategy = this.strategyMap.get('tag');

      if (strategy && isFilterable(strategy)) {
        results = strategy.filter(results, parsed.tags, app);
      }
    }

    // Apply date filter
    if (parsed.dateFilter) {
      const strategy = this.strategyMap.get(parsed.dateFilter.field);

      if (strategy && isFilterable(strategy)) {
        results = strategy.filter(results, parsed.dateFilter, app);
      }
    }

    // Apply path filter (before file type filter to work on all files)
    if (parsed.pathFilter) {
      const strategy = this.strategyMap.get('path');

      if (strategy && isFilterable(strategy)) {
        results = strategy.filter(results, parsed.pathFilter, app);
      }
    }

    // Apply excalidraw filter (frontmatter-based, separate from extension types)
    const excalidrawTypes = parsed.fileTypes.filter(t => t === 'excalidraw');
    const extensionTypes = parsed.fileTypes.filter(t => t !== 'excalidraw');

    if (excalidrawTypes.length > 0) {
      const strategy = this.strategyMap.get('excalidraw') as ExcalidrawFilter;

      results = strategy.filter(results, excalidrawTypes, app);
    }

    // Apply file type filter (skip markdown-only default when path filter is active)
    const fileTypeStrategy = this.strategyMap.get('pdf') as FileTypeFilter;
    const effectiveFileTypes = parsed.pathFilter && extensionTypes.length === 0
      ? ['*']
      : extensionTypes;

    results = fileTypeStrategy.filter(results, effectiveFileTypes, app);

    // Apply metadata filters (frontmatter key:value)
    if (parsed.metadataFilters && parsed.metadataFilters.length > 0) {
      const strategy = this.strategyMap.get('meta');

      if (strategy && isFilterable(strategy)) {
        results = strategy.filter(results, parsed.metadataFilters, app);
      }
    }

    // Apply negations (esclusioni -x)
    if (parsed.negations) {
      const strategy = this.strategyMap.get('not');

      if (strategy && isFilterable(strategy)) {
        results = strategy.filter(results, parsed.negations, app);
      }
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

  async filterFreeText(files: TFile[], parsed: ParsedQuery, app: App): Promise<TFile[]> {
    // Apply highlight filter (async, reads file content)
    if (parsed.highlightFilter) {
      return this.highlightFilter.filterAsync(files, parsed.highlightFilter, app);
    }

    if (!parsed.freeText) {
      return files.sort((a, b) => b.stat.mtime - a.stat.mtime);
    }

    const searchIndex = SearchIndex.getInstance(app);
    const hasExplicitFileTypes = parsed.fileTypes.length > 0;

    // No explicit file type filter: use MiniSearch (markdown + documenti esterni
    // tipo PDF/OCR) + basename search per i file non indicizzati
    if (!hasExplicitFileTypes && searchIndex.isIndexReady()) {
      const candidatePaths = new Set(files.map(f => f.path));
      const indexResults = searchIndex.search(parsed.freeText).filter(f => candidatePaths.has(f.path));
      const foundPaths = new Set(indexResults.map(f => f.path));
      const remainingNonMd = files.filter(f => f.extension !== 'md' && !foundPaths.has(f.path));
      const otherResults = searchIndex.searchInTitlesWithoutIndex(parsed.freeText, remainingNonMd);

      return [...indexResults, ...otherResults];
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

    // 1.5 Extract negations (-image, -#tag) PRIMA delle altre strategy:
    // "-image" verrebbe altrimenti catturato da FileTypeFilter, "-#tag" da TagsFilter
    const negationStrategy = this.getStrategy('not') as NegationFilter;

    result.negations = negationStrategy.extract(remainingText);
    remainingText = negationStrategy.removeFrom(remainingText);

    // 2. Extract tags (#react #css)
    const tagStrategy = this.getStrategy('tag') as TagsFilter;

    result.tags = tagStrategy.extract(remainingText);
    remainingText = tagStrategy.removeFrom(remainingText);

    // 3. Extract date filters (modified:VALUE or created:VALUE)
    const modifiedStrategy = this.getStrategy('modified') as ModifiedFilter;
    const createdStrategy = this.getStrategy('created') as CreatedFilter;

    result.dateFilter = modifiedStrategy.extract(remainingText) ?? createdStrategy.extract(remainingText);
    remainingText = modifiedStrategy.removeFrom(remainingText);
    remainingText = createdStrategy.removeFrom(remainingText);

    // 4. Extract file type filters (pdf, image, canvas, json, base)
    const fileTypeKeys = ['pdf', 'image', 'canvas', 'json', 'base'];

    for (const key of fileTypeKeys) {
      const strategy = this.getStrategy(key) as FileTypeFilter;

      result.fileTypes.push(...strategy.extract(remainingText));
      remainingText = strategy.removeFrom(remainingText);
    }

    // Extract excalidraw filter (frontmatter-based, not extension-based)
    const excalidrawStrategy = this.getStrategy('excalidraw') as ExcalidrawFilter;

    result.fileTypes.push(...excalidrawStrategy.extract(remainingText));
    remainingText = excalidrawStrategy.removeFrom(remainingText);

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

    // 7. Extract path filter (in:cartella)
    const pathStrategy = this.getStrategy('path') as PathFilter;

    result.pathFilter = pathStrategy.extract(remainingText);
    remainingText = pathStrategy.removeFrom(remainingText);

    // 8. Extract highlight filter (highlight:parola)
    result.highlightFilter = this.highlightFilter.extract(remainingText);
    remainingText = this.highlightFilter.removeFrom(remainingText);

    // 8.5 Extract metadata filters (author:rossi, status:draft, ...).
    // Va per ultimo tra i key:value: le chiavi riservate sono già state consumate.
    const metadataStrategy = this.getStrategy('meta') as MetadataFilter;

    result.metadataFilters = metadataStrategy.extract(remainingText);
    remainingText = metadataStrategy.removeFrom(remainingText);

    // 9. What's left is free text
    result.freeText = remainingText.trim();

    return result;
  }
}
