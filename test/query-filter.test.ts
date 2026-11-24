import { App, TFile } from "obsidian";
import { SearchStrategyFactory } from "../src/engine/SearchStrategy";
import { SearchIndex } from "../src/engine/SearchIndex";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Pins how the Filters of a parsed Query narrow the Vault together, so the loop that applies them
// can be rewritten without changing a search.

const NOW = Date.now();
const LONG_AGO = new Date(2000, 0, 1).getTime();

interface FakeNote {
  tags?: string[];
  frontmatter?: Record<string, unknown>;
  tasks?: string[];
  mtime?: number;
}

function fakeFile(path: string, note: FakeNote): TFile {
  const name = path.split('/').pop() as string;
  const mtime = note.mtime ?? LONG_AGO;

  return Object.assign(new TFile(), {
    path,
    basename: name.replace(/\.\w+$/, ''),
    extension: name.split('.').pop(),
    parent: { path: path.split('/').slice(0, -1).join('/') },
    stat: { mtime, ctime: mtime },
  });
}

const VAULT: Record<string, FakeNote> = {
  'Work/plan.md': { tags: ['#project/alpha'], frontmatter: { status: 'draft' }, tasks: [' '], mtime: NOW },
  'Work/report.pdf': {},
  'Work/chart.png': {},
  'Work/old.md': { tags: ['#project', '#archive'] },
  'Home/recipe.md': { tags: ['#food'], tasks: ['x'] },
  'Home/photo.jpg': {},
  'Home/sketch.md': { frontmatter: { 'excalidraw-plugin': 'parsed' } },
};

const FILES = Object.entries(VAULT).map(([path, note]) => fakeFile(path, note));

const APP = {
  metadataCache: {
    getFileCache: (file: TFile) => {
      const note = VAULT[file.path];

      return {
        tags: note.tags,
        frontmatter: note.frontmatter,
        listItems: note.tasks?.map(task => ({ task })),
      };
    },
  },
} as unknown as App;

function search(query: string): string[] {
  const factory = SearchStrategyFactory.getInstance();

  return factory.filter(FILES, factory.parse(query), APP).map(f => f.path);
}

beforeEach(() => {
  (SearchIndex as any)._instance = null;
});

describe('filter: archive', () => {
  it('leaves archived notes out of a query without tags', () => {
    expect(search('')).not.toContain('Work/old.md');
  });

  it('brings them back when the query asks for #archive', () => {
    expect(search('#archive')).toEqual(['Work/old.md']);
  });
});

describe('filter: single filters', () => {
  it.each([
    ['#project', ['Work/plan.md']],
    ['#food', ['Home/recipe.md']],
    ['path:work', ['Work/plan.md', 'Work/report.pdf', 'Work/chart.png']],
    ['pdf', ['Work/report.pdf']],
    ['pdf image', ['Work/report.pdf', 'Work/chart.png', 'Home/photo.jpg']],
    ['excalidraw', ['Home/sketch.md']],
    ['-image', ['Work/plan.md', 'Work/report.pdf', 'Home/recipe.md', 'Home/sketch.md']],
    ['-#food', ['Work/plan.md', 'Work/report.pdf', 'Work/chart.png', 'Home/photo.jpg', 'Home/sketch.md']],
    ['status:draft', ['Work/plan.md']],
    ['task:', ['Work/plan.md', 'Home/recipe.md']],
    ['task-todo:', ['Work/plan.md']],
    ['task-done:', ['Home/recipe.md']],
    ['modified:today', ['Work/plan.md']],
    ['title:photo', ['Home/photo.jpg']],
  ])('%j', (query, expected) => {
    expect(search(query)).toEqual(expected);
  });
});

describe('filter: filters combine', () => {
  it.each([
    ['#project path:work task-todo:', ['Work/plan.md']],
    ['path:home -image', ['Home/recipe.md', 'Home/sketch.md']],
    ['path:work pdf', ['Work/report.pdf']],
    ['#food path:work', []],
    // Excalidraw narrows by frontmatter before the extension types apply, so it does not OR with them.
    ['excalidraw pdf', []],
  ])('%j', (query, expected) => {
    expect(search(query)).toEqual(expected);
  });
});
