import { SearchIndex } from "../src/engine/SearchIndex";
import { fakeApp, fakeFile, resetCommonCaches } from "./helpers/fakeVault";

describe('SearchIndex.searchFilesWithoutIndex (fallback)', () => {
  beforeEach(resetCommonCaches);

  it('finds the term in the content even with regex metacharacters (c++)', async () => {
    const app = fakeApp({
      'cpp.md': 'Guida al linguaggio c++ e alla STL',
      'altro.md': 'Contenuto senza il termine cercato',
    });
    const idx = SearchIndex.getInstance(app);
    const files = [fakeFile('cpp.md'), fakeFile('altro.md')];

    const result = await idx.searchFilesWithoutIndex('c++', files);

    // Unescaped, "c++" is an invalid regex ("Nothing to repeat") and the content match is lost.
    expect(result.map(f => f.path)).toContain('cpp.md');
  });

  it('does not read the dot as a wildcard (3.5 ≠ 315)', async () => {
    const app = fakeApp({
      'esatto.md': 'versione 3.5 stabile',
      'falso.md': 'codice 315 di errore',
    });
    const idx = SearchIndex.getInstance(app);
    const files = [fakeFile('esatto.md'), fakeFile('falso.md')];

    const result = await idx.searchFilesWithoutIndex('3.5', files);

    expect(result.map(f => f.path)).toEqual(['esatto.md']);
  });

  it('handles parentheses without losing the content match', async () => {
    const app = fakeApp({
      'note.md': 'funzione report(2024) chiamata qui',
    });
    const idx = SearchIndex.getInstance(app);
    const files = [fakeFile('note.md')];

    const result = await idx.searchFilesWithoutIndex('report(2024)', files);

    expect(result.map(f => f.path)).toEqual(['note.md']);
  });
});
