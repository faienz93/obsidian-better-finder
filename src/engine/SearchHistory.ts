import { HISTORY_MAX_ENTRIES } from "src/const";

/**
 * Search history: the last N queries that led to opening a result. Persisted in the plugin data:
 * main.ts injects the saved entries and the persistence callback through init().
 */
export class SearchHistory {
  private static _instance: SearchHistory | null;
  private entries: string[] = [];
  private persist: (entries: string[]) => void = () => { /* no-op until initialised */ };

  public static getInstance(): SearchHistory {
    if (!SearchHistory._instance) {
      SearchHistory._instance = new SearchHistory();
    }

    return SearchHistory._instance;
  }

  init(entries: string[], persist: (entries: string[]) => void): void {
    this.entries = entries.slice(0, HISTORY_MAX_ENTRIES);
    this.persist = persist;
  }

  add(query: string): void {
    const trimmed = query.trim();

    if (!trimmed) return;

    // Dedup: the query moves back to the top.
    this.entries = [trimmed, ...this.entries.filter(e => e !== trimmed)].slice(0, HISTORY_MAX_ENTRIES);
    this.persist(this.entries);
  }

  getAll(): string[] {
    return [...this.entries];
  }
}
