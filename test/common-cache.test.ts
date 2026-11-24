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
 * XbergExtractor persists its cache with window.setTimeout, correct inside
 * Obsidian/Electron but absent in the 'node' test environment. A minimal stub
 * beats pulling in jsdom for two lines; the timer never needs to fire.
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

/** App with fake contents for cachedRead and a non-FileSystemAdapter adapter. */
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

describe('CommonCache: the three caches expose the same lifecycle', () => {
  beforeEach(() => {
    (CanvasTagCache as any)._instance = null;
    (XbergExtractor as any)._instance = null;
  });

  it('CanvasTagCache declares which files belong to it', () => {
    const cache = CanvasTagCache.getInstance(fakeApp());

    expect(cache.handles(fakeFile('disegno.canvas', 'canvas'))).toBe(true);
    expect(cache.handles(fakeFile('nota.md', 'md'))).toBe(false);
  });

  it('XbergExtractor declares which files belong to it', () => {
    const extractor = XbergExtractor.getInstance(fakeApp());

    expect(extractor.handles(fakeFile('doc.pdf', 'pdf'))).toBe(true);
    expect(extractor.handles(fakeFile('foto.png', 'png'))).toBe(true);
    expect(extractor.handles(fakeFile('nota.md', 'md'))).toBe(false);
  });
});

describe('XbergExtractor.onDelete (bug: the entry was orphaned)', () => {
  beforeEach(() => {
    (XbergExtractor as any)._instance = null;
  });

  it('drops the entry when the file is deleted', async () => {
    const extractor = XbergExtractor.getInstance(fakeApp());
    const file = fakeFile('report.pdf', 'pdf');

    // Simulate an extraction that already happened.
    (extractor as any).cache.set(file.path, { mtime: 0, text: 'testo estratto' });

    await extractor.onDelete(file);

    expect((extractor as any).cache.has(file.path)).toBe(false);
  });

  it('ignores files that do not belong to it', async () => {
    const extractor = XbergExtractor.getInstance(fakeApp());

    (extractor as any).cache.set('nota.md', { mtime: 0, text: 'should not be here' });

    await extractor.onDelete(fakeFile('nota.md', 'md'));

    expect((extractor as any).cache.has('nota.md')).toBe(true);
  });
});

describe('XbergExtractor.onRename (bug: it re-extracted from scratch)', () => {
  beforeEach(() => {
    (XbergExtractor as any)._instance = null;
    // onRename writes to the index: reset it, or the singleton stays bound to
    // the fakeApp of whichever test built it first.
    (SearchIndex as any)._instance = null;
  });

  it('re-keys the entry to the new path without re-extracting', async () => {
    const extractor = XbergExtractor.getInstance(fakeApp());
    const renamed = fakeFile('nuovo.pdf', 'pdf');

    (extractor as any).cache.set('vecchio.pdf', { mtime: 0, text: 'expensive text' });

    // A real extraction needs the binary, absent here, so it would lose the
    // text. This only passes if the entry is moved.
    await extractor.onRename(renamed, 'vecchio.pdf');

    expect((extractor as any).cache.has('vecchio.pdf')).toBe(false);
    expect((extractor as any).cache.get('nuovo.pdf')?.text).toBe('expensive text');
  });
});

describe('SearchIndex as a common cache', () => {
  beforeEach(() => {
    (SearchIndex as any)._instance = null;
  });

  it('owns markdown and the external documents it has indexed', () => {
    const index = SearchIndex.getInstance(fakeApp());
    const pdf = fakeFile('report.pdf', 'pdf');

    expect(index.handles(fakeFile('nota.md', 'md'))).toBe(true);
    expect(index.handles(pdf)).toBe(false);

    index.addExternalDocument(pdf, 'testo estratto');

    expect(index.handles(pdf)).toBe(true);
  });

  it('owns a renamed file whose OLD path it had indexed', () => {
    const index = SearchIndex.getInstance(fakeApp());

    index.addExternalDocument(fakeFile('vecchio.pdf', 'pdf'), 'testo estratto');

    // On rename the TFile carries the NEW path, not yet indexed: if handles()
    // only looked at that, dispatch would skip the index and the old path would
    // stay in forever.
    expect(index.handles(fakeFile('nuovo.pdf', 'pdf'), 'vecchio.pdf')).toBe(true);

    // A non-markdown that was never indexed stays out.
    expect(index.handles(fakeFile('altro.pdf', 'pdf'), 'mai-visto.pdf')).toBe(false);
  });

  it('discards the old path when a non-markdown is renamed', async () => {
    const index = SearchIndex.getInstance(fakeApp());
    const pdf = fakeFile('vecchio.pdf', 'pdf');

    index.addExternalDocument(pdf, 'testo estratto');
    expect((index as any).indexedPaths.has('vecchio.pdf')).toBe(true);

    await index.onRename(fakeFile('nuovo.pdf', 'pdf'), 'vecchio.pdf');

    expect((index as any).indexedPaths.has('vecchio.pdf')).toBe(false);
  });

  it('removes the old document from the index, not just from indexedPaths', async () => {
    const index = SearchIndex.getInstance(fakeApp());

    index.addExternalDocument(fakeFile('vecchio.pdf', 'pdf'), 'quarterly report');
    const before = index.getStats().total;

    await index.onRename(fakeFile('nuovo.pdf', 'pdf'), 'vecchio.pdf');

    // getStats reads MiniSearch, not the Set: without discard() the path would
    // be gone but the document would still be searchable.
    expect(index.getStats().total).toBe(before - 1);
  });

  it('does not re-add a renamed non-markdown: the cache owning the text does', async () => {
    const index = SearchIndex.getInstance(fakeApp());

    index.addExternalDocument(fakeFile('vecchio.pdf', 'pdf'), 'testo estratto');

    await index.onRename(fakeFile('nuovo.pdf', 'pdf'), 'vecchio.pdf');

    // updateFile() returns early on non-markdown, and XbergExtractor holds the
    // text: here we only check nothing stale is left behind.
    expect((index as any).indexedPaths.has('nuovo.pdf')).toBe(false);
  });
});

describe('Renaming a PDF: the full trip through the registry', () => {
  beforeEach(() => {
    (SearchIndex as any)._instance = null;
    (XbergExtractor as any)._instance = null;
  });

  /** The same dispatch as main.ts, in the same order. */
  async function dispatchRename(caches: any[], file: TFile, oldPath: string) {
    for (const cache of caches) {
      if (!cache.handles(file, oldPath)) continue;

      await cache.onRename(file, oldPath);
    }
  }

  it('the document leaves under the old path and returns under the new one', async () => {
    const app = fakeApp();
    const index = SearchIndex.getInstance(app);
    const extractor = XbergExtractor.getInstance(app);

    // Starting state: the PDF has been extracted and indexed.
    index.addExternalDocument(fakeFile('vecchio.pdf', 'pdf'), 'quarterly report');
    (extractor as any).cache.set('vecchio.pdf', { mtime: 0, text: 'quarterly report' });

    const before = index.getStats().total;

    await dispatchRename([index, extractor], fakeFile('nuovo.pdf', 'pdf'), 'vecchio.pdf');

    // Nothing lost or duplicated: one out, one in.
    expect(index.getStats().total).toBe(before);
    expect((index as any).indexedPaths.has('vecchio.pdf')).toBe(false);
    expect((index as any).indexedPaths.has('nuovo.pdf')).toBe(true);
    // The text was moved, not re-extracted: there is no binary here.
    expect((extractor as any).cache.get('nuovo.pdf')?.text).toBe('quarterly report');
  });

  it('order does not matter: discard and re-add touch different keys', async () => {
    const app = fakeApp();
    const index = SearchIndex.getInstance(app);
    const extractor = XbergExtractor.getInstance(app);

    index.addExternalDocument(fakeFile('vecchio.pdf', 'pdf'), 'testo');
    (extractor as any).cache.set('vecchio.pdf', { mtime: 0, text: 'testo' });

    // Reversed against main.ts: the extractor re-adds the new path first, then
    // the index discards the old one. The outcome must hold either way.
    await dispatchRename([extractor, index], fakeFile('nuovo.pdf', 'pdf'), 'vecchio.pdf');

    expect((index as any).indexedPaths.has('nuovo.pdf')).toBe(true);
    expect((index as any).indexedPaths.has('vecchio.pdf')).toBe(false);
  });
});

describe('CanvasTagCache lifecycle', () => {
  beforeEach(() => {
    (CanvasTagCache as any)._instance = null;
  });

  it('onDelete drops the canvas tags', async () => {
    const cache = CanvasTagCache.getInstance(fakeApp({ 'board.canvas': '{}' }));
    const file = fakeFile('board.canvas', 'canvas');

    (cache as any).cache.set(file.path, { mtime: 0, tags: ['#idea'] });

    await cache.onDelete(file);

    expect((cache as any).cache.has(file.path)).toBe(false);
  });

  it('onRename moves the entry to the new path', async () => {
    const app = fakeApp({ 'nuovo.canvas': JSON.stringify({ nodes: [] }) });
    const cache = CanvasTagCache.getInstance(app);

    (cache as any).cache.set('vecchio.canvas', { mtime: 0, tags: ['#idea'] });

    await cache.onRename(fakeFile('nuovo.canvas', 'canvas'), 'vecchio.canvas');

    expect((cache as any).cache.has('vecchio.canvas')).toBe(false);
    expect((cache as any).cache.has('nuovo.canvas')).toBe(true);
  });
});
