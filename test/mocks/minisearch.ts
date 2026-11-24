/**
 * Minimal MiniSearch mock: SearchIndex needs the constructor to exist in tests, but the fallback
 * tests never use the full-text index.
 */
export default class MiniSearch {
  constructor(_options?: unknown) { /* stub */ }
  addAll(_docs: unknown[]): void { /* stub */ }
  add(_doc: unknown): void { /* stub */ }
  discard(_id: string): void { /* stub */ }
  removeAll(): void { /* stub */ }
  search(_query: string): unknown[] { return []; }
}
