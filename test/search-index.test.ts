import { App, TFile } from "obsidian";
import { SearchIndex } from "../src/engine/SearchIndex";

/* eslint-disable @typescript-eslint/no-explicit-any */

function fakeFile(path: string, extension = 'md'): TFile {
  const basename = path.split('/').pop()?.replace(/\.\w+$/, '') ?? path;

  return { path, basename, extension, stat: { mtime: 0, ctime: 0 } } as unknown as TFile;
}

/** App con contenuti file finti per cachedRead */
function fakeApp(contentByPath: Record<string, string>): App {
  return {
    vault: {
      cachedRead: (file: TFile) => Promise.resolve(contentByPath[(file as any).path] ?? ''),
    },
  } as unknown as App;
}

describe('SearchIndex.searchFilesWithoutIndex (fallback)', () => {
  // SearchIndex è un singleton: azzeriamo l'istanza tra i test così ognuno
  // usa la propria fakeApp (altrimenti resta bindato al primo app).
  beforeEach(() => {
    (SearchIndex as any)._instance = null;
  });

  it('trova il termine nel contenuto anche con metacaratteri regex (c++)', async () => {
    const app = fakeApp({
      'cpp.md': 'Guida al linguaggio c++ e alla STL',
      'altro.md': 'Contenuto senza il termine cercato',
    });
    const idx = SearchIndex.getInstance(app);
    const files = [fakeFile('cpp.md'), fakeFile('altro.md')];

    const result = await idx.searchFilesWithoutIndex('c++', files);

    // Il file con "c++" nel contenuto DEVE comparire: con un regex non escapato
    // "c++" è invalido ("Nothing to repeat") e il match nel contenuto va perso.
    expect(result.map(f => f.path)).toContain('cpp.md');
  });

  it('non interpreta il punto come wildcard (3.5 ≠ 315)', async () => {
    const app = fakeApp({
      'esatto.md': 'versione 3.5 stabile',
      'falso.md': 'codice 315 di errore',
    });
    const idx = SearchIndex.getInstance(app);
    const files = [fakeFile('esatto.md'), fakeFile('falso.md')];

    const result = await idx.searchFilesWithoutIndex('3.5', files);

    // "." non deve fare da wildcard: solo "3.5" letterale deve matchare.
    expect(result.map(f => f.path)).toEqual(['esatto.md']);
  });

  it('gestisce parentesi/graffe senza perdere i match di contenuto', async () => {
    const app = fakeApp({
      'note.md': 'funzione report(2024) chiamata qui',
    });
    const idx = SearchIndex.getInstance(app);
    const files = [fakeFile('note.md')];

    const result = await idx.searchFilesWithoutIndex('report(2024)', files);

    expect(result.map(f => f.path)).toEqual(['note.md']);
  });
});
