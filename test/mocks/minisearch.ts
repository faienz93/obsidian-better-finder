/**
 * Mock minimale di MiniSearch: il costruttore va soddisfatto per istanziare
 * SearchIndex nei test, ma i test del fallback non usano l'indice full-text.
 */
export default class MiniSearch {
  constructor(_options?: unknown) { /* stub */ }
  addAll(_docs: unknown[]): void { /* stub */ }
  add(_doc: unknown): void { /* stub */ }
  discard(_id: string): void { /* stub */ }
  removeAll(): void { /* stub */ }
  search(_query: string): unknown[] { return []; }
}
