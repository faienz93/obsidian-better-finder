import { App, Command, TFile } from "obsidian";
import { Finder, SearchResult } from "../src/Finder";
import { SearchIndex } from "../src/engine/SearchIndex";

/* eslint-disable @typescript-eslint/no-explicit-any */

// The fuzzy and prefix matching under test belong to MiniSearch itself, so this file uses the real one.
jest.mock('minisearch', () => ({
  __esModule: true,
  default: jest.requireActual('../node_modules/minisearch/dist/cjs/index.cjs'),
}));

function fakeFile(path: string): TFile {
  const name = path.split('/').pop() ?? path;
  const extension = name.includes('.') ? name.split('.').pop() as string : '';
  const basename = name.replace(/\.\w+$/, '');

  return Object.assign(new TFile(), { path, basename, extension, stat: { mtime: 0, ctime: 0 } });
}

/** A vault whose files are the keys of contentByPath, read through cachedRead. */
function fakeApp(contentByPath: Record<string, string>, commands: Command[] = []): App {
  const files = Object.keys(contentByPath).map(fakeFile);

  return {
    vault: {
      getFiles: () => files,
      getMarkdownFiles: () => files.filter(f => f.extension === 'md'),
      getAbstractFileByPath: (path: string) => files.find(f => f.path === path) ?? null,
      cachedRead: (file: TFile) => Promise.resolve(contentByPath[file.path] ?? ''),
      on: () => ({}),
      offref: () => undefined,
    },
    metadataCache: { getFileCache: () => null },
    commands: { listCommands: () => commands },
  } as unknown as App;
}

const paths = (results: SearchResult[]) => results.map(r => (r as TFile).path);

const VAULT = {
  'layers.md': 'Notes on software architettura and layers',
  'greeting.md': 'ciao a tutti\n\nrighe in mezzo\n\nil mondo intero',
  'recipe.md': 'pasta al pomodoro',
  'architettura-diagram.png': '',
};

describe('Finder.getResults: search outcome', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    (SearchIndex as any)._instance = null;
  });

  describe('through the Index', () => {
    async function finderWithIndex(contentByPath: Record<string, string>): Promise<Finder> {
      const app = fakeApp(contentByPath);

      await SearchIndex.getInstance(app).buildIndex();

      return new Finder(app);
    }

    it('carries the parsed query', async () => {
      const finder = await finderWithIndex(VAULT);

      const outcome = await finder.getResults('#project ciao');

      expect(outcome.parsed.tags).toEqual(['#project']);
      expect(outcome.parsed.freeText).toBe('ciao');
    });

    it('reports the terms MiniSearch matched for each file', async () => {
      const finder = await finderWithIndex(VAULT);

      const outcome = await finder.getResults('ciao mondo');

      expect(paths(outcome.results)).toEqual(['greeting.md']);
      expect(outcome.matchedWords.get('greeting.md')?.sort()).toEqual(['ciao', 'mondo']);
    });

    it('reports the correctly spelt term for a misspelt long word', async () => {
      const finder = await finderWithIndex(VAULT);

      const outcome = await finder.getResults('architetura');

      expect(paths(outcome.results)).toContain('layers.md');
      expect(outcome.matchedWords.get('layers.md')).toEqual(['architettura']);
    });

    it('reports the full word a prefix matched', async () => {
      const finder = await finderWithIndex(VAULT);

      const outcome = await finder.getResults('pomo');

      expect(outcome.matchedWords.get('recipe.md')).toEqual(['pomodoro']);
    });

    it('reports the free text words for a non-markdown file found by its name', async () => {
      const finder = await finderWithIndex(VAULT);

      const outcome = await finder.getResults('diagram');

      expect(paths(outcome.results)).toEqual(['architettura-diagram.png']);
      expect(outcome.matchedWords.get('architettura-diagram.png')).toEqual(['diagram']);
    });
  });

  describe('without the Index', () => {
    it('reports the words of the free text', async () => {
      const finder = new Finder(fakeApp(VAULT));

      const outcome = await finder.getResults('Pasta al');

      expect(paths(outcome.results)).toEqual(['recipe.md']);
      expect(outcome.matchedWords.get('recipe.md')).toEqual(['pasta', 'al']);
    });
  });

  it('reports no words when the query has no free text', async () => {
    const finder = new Finder(fakeApp(VAULT));

    const outcome = await finder.getResults('');

    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.matchedWords.size).toBe(0);
  });

  it('keeps returning commands in command mode', async () => {
    const command = { id: 'app:toggle', name: 'Toggle sidebar' } as Command;
    const finder = new Finder(fakeApp(VAULT, [command]));

    const outcome = await finder.getResults('> toggle');

    expect(outcome.parsed.isCommandMode).toBe(true);
    expect(outcome.results).toEqual([command]);
    expect(outcome.matchedWords.size).toBe(0);
  });
});
