import { SearchResult } from '../Finder';

export const SEARCH_DEBOUNCE_MS = 150;

export interface SearchSource {
  getResults(query: string): Promise<SearchResult[]>;
}

/**
 * Debounces the searches typed into one UI and lets only the latest one through.
 * A superseded search never settles: SuggestModal renders whatever any promise resolves to, so
 * resolving shows stale results or flashes "no results", and rejecting logs an error.
 */
export class LatestSearch {
  private timer: number | null = null;
  private generation = 0;

  constructor(
    private readonly source: SearchSource,
    private readonly delayMs = SEARCH_DEBOUNCE_MS
  ) {}

  run(query: string): Promise<SearchResult[]> {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
    }

    const generation = ++this.generation;

    return new Promise((resolve) => {
      this.timer = window.setTimeout(async () => {
        this.timer = null;
        const results = await this.source.getResults(query);

        if (generation === this.generation) {
          resolve(results);
        }
      }, this.delayMs);
    });
  }

  /** Supersedes the pending and in-flight search, e.g. when the UI closes. */
  cancel(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }

    this.generation++;
  }
}
