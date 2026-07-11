const MAX_ENTRIES = 20;

/**
 * Cronologia delle ricerche (ultime N query che hanno portato all'apertura
 * di un risultato). Persistita nei dati del plugin: main.ts inietta le voci
 * salvate e la callback di persistenza via init().
 */
export class SearchHistory {
  private static _instance: SearchHistory | null;
  private entries: string[] = [];
  private persist: (entries: string[]) => void = () => { /* no-op finché non inizializzata */ };

  public static getInstance(): SearchHistory {
    if (!SearchHistory._instance) {
      SearchHistory._instance = new SearchHistory();
    }

    return SearchHistory._instance;
  }

  init(entries: string[], persist: (entries: string[]) => void): void {
    this.entries = entries.slice(0, MAX_ENTRIES);
    this.persist = persist;
  }

  add(query: string): void {
    const trimmed = query.trim();

    if (!trimmed) return;

    // Dedup: la query risale in cima
    this.entries = [trimmed, ...this.entries.filter(e => e !== trimmed)].slice(0, MAX_ENTRIES);
    this.persist(this.entries);
  }

  getAll(): string[] {
    return [...this.entries];
  }
}
