import { App, TFile } from "obsidian";
import { CanvasTagCache } from "../src/engine/CanvasTagCache";
import { XbergExtractor } from "../src/engine/XbergExtractor";
import { SearchIndex } from "../src/engine/SearchIndex";

/* eslint-disable @typescript-eslint/no-explicit-any */

function fakeFile(path: string, extension: string, mtime = 0): TFile {
  const basename = path.split('/').pop()?.replace(/\.\w+$/, '') ?? path;

  return { path, basename, extension, stat: { mtime, ctime: 0 } } as unknown as TFile;
}

/**
 * XbergExtractor salva la cache su disco con window.setTimeout (corretto dentro
 * Obsidian/Electron). I test girano in ambiente 'node', dove window non esiste:
 * invece di tirarsi dietro jsdom per due righe, lo stub minimo basta. Il timer
 * non deve nemmeno partire: qui interessa che la cache in memoria sia giusta.
 */
beforeAll(() => {
  (globalThis as any).window = {
    setTimeout: () => 0,
    clearTimeout: () => undefined,
  };
});

afterAll(() => {
  delete (globalThis as any).window;
});

/** App con contenuti finti per cachedRead e un adapter che non è FileSystemAdapter */
function fakeApp(contentByPath: Record<string, string> = {}): App {
  return {
    vault: {
      cachedRead: (file: TFile) => Promise.resolve(contentByPath[(file as any).path] ?? ''),
      getFiles: () => [],
      adapter: {
        exists: () => Promise.resolve(false),
        read: () => Promise.resolve('{}'),
        write: () => Promise.resolve(),
      },
    },
  } as unknown as App;
}

describe('CommonCache — le tre cache espongono lo stesso ciclo di vita', () => {
  beforeEach(() => {
    (CanvasTagCache as any)._instance = null;
    (XbergExtractor as any)._instance = null;
  });

  it('CanvasTagCache dichiara quali file le appartengono', () => {
    const cache = CanvasTagCache.getInstance(fakeApp());

    expect(cache.handles(fakeFile('disegno.canvas', 'canvas'))).toBe(true);
    expect(cache.handles(fakeFile('nota.md', 'md'))).toBe(false);
  });

  it('XbergExtractor dichiara quali file gli appartengono', () => {
    const extractor = XbergExtractor.getInstance(fakeApp());

    expect(extractor.handles(fakeFile('doc.pdf', 'pdf'))).toBe(true);
    expect(extractor.handles(fakeFile('foto.png', 'png'))).toBe(true);
    expect(extractor.handles(fakeFile('nota.md', 'md'))).toBe(false);
  });
});

describe('XbergExtractor.onDelete (bug: la voce restava orfana)', () => {
  beforeEach(() => {
    (XbergExtractor as any)._instance = null;
  });

  it('cancellando il file la voce esce dalla cache', async () => {
    const extractor = XbergExtractor.getInstance(fakeApp());
    const file = fakeFile('report.pdf', 'pdf');

    // Simula una estrazione già avvenuta
    (extractor as any).cache.set(file.path, { mtime: 0, text: 'testo estratto' });

    await extractor.onDelete(file);

    expect((extractor as any).cache.has(file.path)).toBe(false);
  });

  it('ignora i file che non gli appartengono', async () => {
    const extractor = XbergExtractor.getInstance(fakeApp());

    (extractor as any).cache.set('nota.md', { mtime: 0, text: 'non dovrebbe stare qui' });

    await extractor.onDelete(fakeFile('nota.md', 'md'));

    expect((extractor as any).cache.has('nota.md')).toBe(true);
  });
});

describe('XbergExtractor.onRename (bug: riestraeva da zero)', () => {
  beforeEach(() => {
    (XbergExtractor as any)._instance = null;
    // onRename scrive nell'indice: azzeralo o il singleton resta legato
    // alla fakeApp del primo test che lo costruisce.
    (SearchIndex as any)._instance = null;
  });

  it('ri-chiava la voce sul nuovo path senza riestrarre', async () => {
    const extractor = XbergExtractor.getInstance(fakeApp());
    const renamed = fakeFile('nuovo.pdf', 'pdf');

    (extractor as any).cache.set('vecchio.pdf', { mtime: 0, text: 'testo costoso' });

    // Se riestraesse servirebbe il binario: qui non c'è, quindi un'estrazione
    // vera perderebbe il testo. Il test passa solo se la voce viene spostata.
    await extractor.onRename(renamed, 'vecchio.pdf');

    expect((extractor as any).cache.has('vecchio.pdf')).toBe(false);
    expect((extractor as any).cache.get('nuovo.pdf')?.text).toBe('testo costoso');
  });
});

describe('SearchIndex come common cache', () => {
  beforeEach(() => {
    (SearchIndex as any)._instance = null;
  });

  it('possiede i markdown e i documenti esterni che ha indicizzato', () => {
    const index = SearchIndex.getInstance(fakeApp());
    const pdf = fakeFile('report.pdf', 'pdf');

    expect(index.handles(fakeFile('nota.md', 'md'))).toBe(true);
    expect(index.handles(pdf)).toBe(false);

    index.addExternalDocument(pdf, 'testo estratto');

    expect(index.handles(pdf)).toBe(true);
  });

  it('possiede un file rinominato di cui aveva il VECCHIO path indicizzato', () => {
    const index = SearchIndex.getInstance(fakeApp());

    index.addExternalDocument(fakeFile('vecchio.pdf', 'pdf'), 'testo estratto');

    // Sul rename il TFile porta il path NUOVO, che non è ancora indicizzato:
    // se handles() guardasse solo quello, il dispatch salterebbe l'indice e il
    // vecchio path resterebbe dentro per sempre.
    expect(index.handles(fakeFile('nuovo.pdf', 'pdf'), 'vecchio.pdf')).toBe(true);

    // Un non-markdown mai indicizzato resta fuori.
    expect(index.handles(fakeFile('altro.pdf', 'pdf'), 'mai-visto.pdf')).toBe(false);
  });

  it('su rename di un non-markdown scarta il vecchio path (B: prima restava)', async () => {
    const index = SearchIndex.getInstance(fakeApp());
    const pdf = fakeFile('vecchio.pdf', 'pdf');

    index.addExternalDocument(pdf, 'testo estratto');
    expect((index as any).indexedPaths.has('vecchio.pdf')).toBe(true);

    await index.onRename(fakeFile('nuovo.pdf', 'pdf'), 'vecchio.pdf');

    expect((index as any).indexedPaths.has('vecchio.pdf')).toBe(false);
  });

  it('dopo il rename il vecchio documento non è più nell indice, non solo fuori da indexedPaths', async () => {
    const index = SearchIndex.getInstance(fakeApp());

    index.addExternalDocument(fakeFile('vecchio.pdf', 'pdf'), 'relazione trimestrale');
    const before = index.getStats().total;

    await index.onRename(fakeFile('nuovo.pdf', 'pdf'), 'vecchio.pdf');

    // getStats legge MiniSearch, non il Set: se discard() mancasse,
    // indexedPaths sarebbe pulito ma il documento resterebbe cercabile.
    expect(index.getStats().total).toBe(before - 1);
  });

  it('il rename di un non-markdown non lo reinserisce: lo fa la cache che possiede il testo', async () => {
    const index = SearchIndex.getInstance(fakeApp());

    index.addExternalDocument(fakeFile('vecchio.pdf', 'pdf'), 'testo estratto');

    await index.onRename(fakeFile('nuovo.pdf', 'pdf'), 'vecchio.pdf');

    // updateFile() esce subito sui non-md: reinserirlo qui non è possibile,
    // il testo ce l'ha XbergExtractor. Qui verifichiamo solo che non resti sporco.
    expect((index as any).indexedPaths.has('nuovo.pdf')).toBe(false);
  });
});

describe('Rename di un PDF: il giro completo attraverso il registro', () => {
  beforeEach(() => {
    (SearchIndex as any)._instance = null;
    (XbergExtractor as any)._instance = null;
  });

  /** Lo stesso dispatch di main.ts, nello stesso ordine. */
  async function dispatchRename(caches: any[], file: TFile, oldPath: string) {
    for (const cache of caches) {
      if (!cache.handles(file, oldPath)) continue;

      await cache.onRename(file, oldPath);
    }
  }

  it('il documento esce col vecchio path e rientra col nuovo, senza riestrarre', async () => {
    const app = fakeApp();
    const index = SearchIndex.getInstance(app);
    const extractor = XbergExtractor.getInstance(app);

    // Stato di partenza: il PDF è stato estratto e indicizzato.
    index.addExternalDocument(fakeFile('vecchio.pdf', 'pdf'), 'relazione trimestrale');
    (extractor as any).cache.set('vecchio.pdf', { mtime: 0, text: 'relazione trimestrale' });

    const before = index.getStats().total;

    await dispatchRename([index, extractor], fakeFile('nuovo.pdf', 'pdf'), 'vecchio.pdf');

    // Nessun documento perso né duplicato: uno esce, uno entra.
    expect(index.getStats().total).toBe(before);
    expect((index as any).indexedPaths.has('vecchio.pdf')).toBe(false);
    expect((index as any).indexedPaths.has('nuovo.pdf')).toBe(true);
    // Il testo è stato spostato, non ri-estratto (qui non c'è nessun binario).
    expect((extractor as any).cache.get('nuovo.pdf')?.text).toBe('relazione trimestrale');
  });

  it('l ordine conta: l indice scarta prima che l extractor reinserisca', async () => {
    const app = fakeApp();
    const index = SearchIndex.getInstance(app);
    const extractor = XbergExtractor.getInstance(app);

    index.addExternalDocument(fakeFile('vecchio.pdf', 'pdf'), 'testo');
    (extractor as any).cache.set('vecchio.pdf', { mtime: 0, text: 'testo' });

    // Ordine invertito rispetto a main.ts: l'extractor reinserisce il nuovo
    // path, poi l'indice scarta il vecchio. Il risultato deve restare corretto.
    await dispatchRename([extractor, index], fakeFile('nuovo.pdf', 'pdf'), 'vecchio.pdf');

    expect((index as any).indexedPaths.has('nuovo.pdf')).toBe(true);
    expect((index as any).indexedPaths.has('vecchio.pdf')).toBe(false);
  });
});

describe('CanvasTagCache — ciclo di vita', () => {
  beforeEach(() => {
    (CanvasTagCache as any)._instance = null;
  });

  it('onDelete toglie i tag del canvas', async () => {
    const cache = CanvasTagCache.getInstance(fakeApp({ 'board.canvas': '{}' }));
    const file = fakeFile('board.canvas', 'canvas');

    (cache as any).cache.set(file.path, { mtime: 0, tags: ['#idea'] });

    await cache.onDelete(file);

    expect((cache as any).cache.has(file.path)).toBe(false);
  });

  it('onRename sposta la voce sul nuovo path', async () => {
    const app = fakeApp({ 'nuovo.canvas': JSON.stringify({ nodes: [] }) });
    const cache = CanvasTagCache.getInstance(app);

    (cache as any).cache.set('vecchio.canvas', { mtime: 0, tags: ['#idea'] });

    await cache.onRename(fakeFile('nuovo.canvas', 'canvas'), 'vecchio.canvas');

    expect((cache as any).cache.has('vecchio.canvas')).toBe(false);
    expect((cache as any).cache.has('nuovo.canvas')).toBe(true);
  });
});
