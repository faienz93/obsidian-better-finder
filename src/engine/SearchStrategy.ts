import { App, TFile } from "obsidian";
import { HintsType } from "src/component/ui/HintBar";
import { SearchIndex } from "./SearchIndex";
import {
  ParsedQuery, QueryField, QueryReader, QueryToken, Narrowing,
  TagsFilter, ModifiedFilter, CreatedFilter,
  FileTypeGroup, PdfFilter, ImageFilter, CanvasFilter, JsonFilter, BaseFilter,
  TitleFilter, CommandFilter, TaskFilter, PathFilter, ExcalidrawFilter, HighlightFilter,
  NegationFilter, MetadataFilter,
} from "./search-filters";

// Re-exported for the files that import them from here.
export type { ParsedQuery, DateRange, TaskStatus } from "./search-filters";
export { SearchFilter } from "./search-filters";

/** Files the free text kept, with the words that made each one match, keyed by path. */
export interface FreeTextResults {
  files: TFile[];
  matchedWords: Map<string, string[]>;
}

// A word, or a quoted run that may hold spaces, with whatever is glued to it: highlight:"two words".
const TOKEN = /(?:[^\s"]+|"[^"]*"?)+/g;
const KEY_VALUE = /^([a-zA-Z][\w-]*):([\s\S]*)$/;

type Reader = QueryReader<QueryField>;

interface Claim {
  reader: Reader;
  token: QueryToken;
}

function unquote(value: string): string {
  return value.replace(/^"|"$/g, '');
}

// Generic so that the field written and the value read keep one type.
function readInto<K extends QueryField>(parsed: ParsedQuery, reader: QueryReader<K>, token: QueryToken): void {
  parsed[reader.field] = reader.read(token, parsed[reader.field]);
}

function narrow<K extends QueryField>(files: TFile[], narrowing: Narrowing<K>, parsed: ParsedQuery, app: App): TFile[] {
  return narrowing.filter(files, parsed[narrowing.field], app);
}

export class SearchStrategyFactory {
  private readonly command = new CommandFilter();
  private readonly tags = new TagsFilter();
  private readonly negation = new NegationFilter();
  private readonly created = new CreatedFilter();
  private readonly modified = new ModifiedFilter();
  private readonly pdf = new PdfFilter();
  private readonly image = new ImageFilter();
  private readonly canvas = new CanvasFilter();
  private readonly json = new JsonFilter();
  private readonly base = new BaseFilter();
  private readonly excalidraw = new ExcalidrawFilter();
  private readonly title = new TitleFilter();
  private readonly task = new TaskFilter();
  private readonly path = new PathFilter();
  private readonly highlightFilter = new HighlightFilter();
  private readonly metadata = new MetadataFilter();

  /** Every Filter that reads tokens. A `key:value` whose key none of them claims is a property. */
  private readonly readers: Reader[] = [
    this.tags, this.negation, this.created, this.modified,
    this.pdf, this.image, this.canvas, this.json, this.base, this.excalidraw,
    this.title, this.task, this.path, this.highlightFilter,
  ];

  /**
   * Applied in turn to the files. Highlight and the title Scope are not here: they replace or
   * narrow the free text search instead.
   */
  private readonly narrowings: Array<Narrowing<QueryField>> = [
    this.tags, this.created, this.modified, this.path, new FileTypeGroup(), this.metadata, this.negation, this.task,
  ];

  private readonly byPrefix = new Map<string, Reader>();
  private readonly byKey = new Map<string, Reader>();
  private readonly byKeyword = new Map<string, Reader>();
  private static _instance: SearchStrategyFactory;

  private constructor() {
    for (const reader of this.readers) {
      if (reader.prefix) this.register(this.byPrefix, reader.prefix, reader);

      reader.keys.forEach(key => this.register(this.byKey, key, reader));
      reader.keywords.forEach(keyword => this.register(this.byKeyword, keyword, reader));
    }
  }

  /** The hint bar chips, in the order they are shown. */
  get hints(): HintsType[] {
    return [
      this.tags, this.created, this.modified, this.command, this.title, this.task,
      this.pdf, this.image, this.canvas, this.json, this.base, this.path, this.excalidraw,
      this.negation, this.metadata, this.highlightFilter,
    ];
  }

  public static getInstance(): SearchStrategyFactory {
    if (!SearchStrategyFactory._instance) {
      SearchStrategyFactory._instance = new SearchStrategyFactory();
    }

    return SearchStrategyFactory._instance;
  }

  /** Two Filters claiming one shape would make the result depend on registration order. */
  private register(claims: Map<string, Reader>, shape: string, reader: Reader): void {
    if (claims.has(shape)) {
      throw new Error(`Query shape claimed twice: ${shape}`);
    }

    claims.set(shape, reader);
  }

  filter(files: TFile[], parsed: ParsedQuery, app: App): TFile[] {
    const results = this.narrowings.reduce((kept, narrowing) => narrow(kept, narrowing, parsed, app), files);

    if (parsed.scope === 'title') {
      return this.title.filter(results, parsed.freeText, app);
    }

    return results;
  }

  async filterFreeText(files: TFile[], parsed: ParsedQuery, app: App): Promise<FreeTextResults> {
    // Apply highlight filter (async, reads file content)
    if (parsed.highlightFilter) {
      return { files: await this.highlightFilter.filterAsync(files, parsed.highlightFilter, app), matchedWords: new Map() };
    }

    if (!parsed.freeText) {
      return { files: files.sort((a, b) => b.stat.mtime - a.stat.mtime), matchedWords: new Map() };
    }

    const searchIndex = SearchIndex.getInstance(app);
    const hasExplicitFileTypes = parsed.fileTypes.length > 0;
    const freeTextWords = [...new Set(parsed.freeText.toLowerCase().split(/\s+/))];

    // No explicit file type filter: MiniSearch (markdown plus external documents such as
    // PDF/OCR), plus a basename search for the files it did not index.
    if (!hasExplicitFileTypes && searchIndex.isIndexReady()) {
      const candidatePaths = new Set(files.map(f => f.path));
      const indexResults = searchIndex.search(parsed.freeText).filter(r => candidatePaths.has(r.file.path));
      const foundPaths = new Set(indexResults.map(r => r.file.path));
      const remainingNonMd = files.filter(f => f.extension !== 'md' && !foundPaths.has(f.path));
      const otherResults = searchIndex.searchInTitlesWithoutIndex(parsed.freeText, remainingNonMd);
      const matchedWords = new Map<string, string[]>(indexResults.map(r => [r.file.path, r.terms]));

      otherResults.forEach(f => matchedWords.set(f.path, freeTextWords));

      return { files: [...indexResults.map(r => r.file), ...otherResults], matchedWords };
    }

    const found = await searchIndex.searchFilesWithoutIndex(parsed.freeText, files);

    return { files: found, matchedWords: new Map<string, string[]>(found.map(f => [f.path, freeTextWords])) };
  }

  parse(input: string): ParsedQuery {
    const trimmedInput = input.trim();
    const result: ParsedQuery = {
      rawInput: trimmedInput,
      isCommandMode: false,
      tags: [],
      fileTypes: [],
      negations: { extensions: [], tags: [] },
      metadataFilters: [],
      freeText: '',
    };
    const command = this.command.extract(trimmedInput);

    if (command.isCommandMode) {
      result.isCommandMode = true;
      result.commandText = command.commandText;

      return result;
    }

    const { claims, freeWords } = this.tokenize(trimmedInput);

    for (const { reader, token } of claims) {
      readInto(result, reader, token);
    }

    result.freeText = freeWords.join(' ');

    return result;
  }

  /** The chips the Query switches on: every Filter that claims one of its words, even half typed. */
  activeHints(query: string): HintsType[] {
    const trimmed = query.trim();

    if (this.command.extract(trimmed).isCommandMode) {
      return [this.command];
    }

    const readers = (trimmed.match(TOKEN) ?? []).map(word => this.claim(word)?.reader);

    return [...new Set(readers)].filter((reader): reader is Reader => reader !== undefined);
  }

  /** Splits the Query into the tokens Filters claim and the words left for the free text. */
  private tokenize(query: string): { claims: Claim[]; freeWords: string[] } {
    const words = query.match(TOKEN) ?? [];
    const claims: Claim[] = [];
    const freeWords: string[] = [];

    for (let i = 0; i < words.length; i++) {
      const claim = this.claim(words[i]);

      if (!claim) {
        freeWords.push(words[i]);
        continue;
      }

      const { reader, token } = claim;

      if (token.value === '' && reader.takesValue) {
        // A bare key takes the next word, as long as no Filter claims it and it is a value it reads.
        const next = words[i + 1];

        if (next === undefined || this.claim(next) || !reader.accepts(unquote(next))) continue;

        token.value = unquote(next);
        i++;
      } else if (!reader.accepts(token.value)) {
        continue;
      }

      claims.push(claim);

      const kept = reader.freeTextOf(token);

      if (kept) freeWords.push(kept);
    }

    return { claims, freeWords };
  }

  /** The Filter a word belongs to by its shape, or nothing when it is free text. */
  private claim(word: string): Claim | undefined {
    const prefixed = this.byPrefix.get(word[0]);

    if (prefixed) {
      const value = word.slice(1);

      return prefixed.accepts(value) ? { reader: prefixed, token: { key: word[0], value } } : undefined;
    }

    const keyValue = KEY_VALUE.exec(word);

    if (keyValue) {
      const key = keyValue[1].toLowerCase();
      const value = unquote(keyValue[2]);
      const keyed = this.byKey.get(key);

      if (keyed) return { reader: keyed, token: { key, value } };

      return this.metadata.accepts(value) ? { reader: this.metadata, token: { key, value } } : undefined;
    }

    const keyword = this.byKeyword.get(word.toLowerCase());

    return keyword ? { reader: keyword, token: { key: '', value: word } } : undefined;
  }
}
