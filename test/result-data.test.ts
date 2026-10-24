import { App, TFile } from "obsidian";
import { Finder } from "../src/Finder";
import { buildResultData, ResultData } from "../src/engine/ResultData";
import { CanvasTagCache } from "../src/engine/CanvasTagCache";
import { SearchIndex } from "../src/engine/SearchIndex";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Which words a free text search matched is decided by MiniSearch itself, so this file uses the real one.
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

interface FakeVaultFile {
  content?: string;
  cache?: any;
}

/** A vault whose files are the keys of vault, each with its content and metadata cache. */
function fakeApp(vault: Record<string, FakeVaultFile>): App {
  const files = Object.keys(vault).map(fakeFile);

  return {
    vault: {
      getFiles: () => files,
      getMarkdownFiles: () => files.filter(f => f.extension === 'md'),
      getAbstractFileByPath: (path: string) => files.find(f => f.path === path) ?? null,
      cachedRead: (file: TFile) => Promise.resolve(vault[file.path]?.content ?? ''),
      on: () => ({}),
      offref: () => undefined,
    },
    metadataCache: { getFileCache: (file: TFile) => vault[file.path]?.cache ?? null },
  } as unknown as App;
}

/** Runs the real search and builds the Data of every file it returns, keyed by path. */
async function search(app: App, query: string, { withIndex = false } = {}): Promise<Map<string, ResultData>> {
  if (withIndex) {
    await SearchIndex.getInstance(app).buildIndex();
  }

  const outcome = await new Finder(app).getResults(query);
  const dataByPath = new Map<string, ResultData>();

  for (const result of outcome.results) {
    const file = result as TFile;

    dataByPath.set(file.path, buildResultData(app, file, outcome));
  }

  return dataByPath;
}

/** A list item on the given zero-based line of its note. */
const onLine = (line: number, task?: string) => ({ task, position: { start: { line } } });

const ALPHA = {
  content: 'alpha\n- [ ] ciao a Marco\n- [x] scrivere il piano\n- [ ] rileggere\n- una lista\n\nciao da alpha',
  cache: {
    tags: ['#project/alpha', '#idea'],
    listItems: [onLine(1, ' '), onLine(2, 'x'), onLine(3, ' '), onLine(4)],
  },
};

describe('buildResultData: what a result shows for a query', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    (CanvasTagCache as any)._instance = null;
    (SearchIndex as any)._instance = null;
  });

  it('with #project, #project/alpha is searched and #idea is not', async () => {
    const app = fakeApp({ 'alpha.md': ALPHA });

    const data = (await search(app, '#project')).get('alpha.md');

    expect(data?.tags).toEqual(['#project/alpha', '#idea']);
    expect(data?.searchedTags).toEqual(['#project/alpha']);
  });

  it('tags keep the case they were saved with and match the query whatever its case', async () => {
    const app = fakeApp({ 'waf.md': { cache: { tags: ['#WAF/Rules', '#Idea'] } } });

    const data = (await search(app, '#waf')).get('waf.md');

    expect(data?.tags).toEqual(['#WAF/Rules', '#Idea']);
    expect(data?.searchedTags).toEqual(['#WAF/Rules']);
  });

  it('a canvas found by #project shows its tags with #project searched', async () => {
    const board = { nodes: [{ type: 'text', text: 'kickoff #project and #Meeting' }] };
    const app = fakeApp({ 'board.canvas': { content: JSON.stringify(board) } });

    await CanvasTagCache.getInstance(app).buildCache();
    const data = (await search(app, '#project')).get('board.canvas');

    expect(data?.tags.sort()).toEqual(['#Meeting', '#project']);
    expect(data?.searchedTags).toEqual(['#project']);
  });

  it.each(['task:', 'task-todo:', 'task-done:'])('with %s the task count is shown', async (query) => {
    const app = fakeApp({ 'alpha.md': ALPHA });

    const data = (await search(app, query)).get('alpha.md');

    expect(data?.taskInfo).toEqual({ done: 1, total: 3 });
  });

  it('without a task filter the task count is not shown', async () => {
    const app = fakeApp({ 'alpha.md': ALPHA });

    const data = (await search(app, '#idea')).get('alpha.md');

    expect(data?.taskInfo).toBeUndefined();
  });

  it('a tag plus a task filter shows both the searched tag and the task count', async () => {
    const app = fakeApp({ 'alpha.md': ALPHA });

    const data = (await search(app, '#project task:')).get('alpha.md');

    expect(data?.searchedTags).toEqual(['#project/alpha']);
    expect(data?.taskInfo).toEqual({ done: 1, total: 3 });
  });

  describe('the file type icon', () => {
    it.each([
      ['report.canvas', 'layout-dashboard', 'canvas'],
      ['report.pdf', 'book-open', 'pdf'],
      ['report.png', 'image', 'png'],
      ['report.JPG', 'image', 'jpg'],
      ['report.docx', 'file-text', 'docx'],
      ['report.xlsx', 'table', 'xlsx'],
      ['report.json', 'braces', 'json'],
      ['report.base', 'database', 'base'],
      ['report.zip', 'file', 'zip'],
    ])('%s shows the %s icon labelled %s', async (path, icon, label) => {
      const app = fakeApp({ [path]: {} });

      const data = (await search(app, 'report')).get(path);

      expect(data?.typeIcon).toEqual({ icon, label });
    });

    it('an Excalidraw drawing shows an icon labelled excalidraw, not md', async () => {
      const app = fakeApp({ 'sketch.md': { cache: { frontmatter: { 'excalidraw-plugin': 'parsed' } } } });

      const data = (await search(app, 'sketch')).get('sketch.md');

      expect(data?.typeIcon).toEqual({ icon: 'pencil', label: 'excalidraw' });
    });

    it('a note shows no icon', async () => {
      const app = fakeApp({ 'alpha.md': ALPHA });

      const data = (await search(app, 'alpha')).get('alpha.md');

      expect(data).toBeDefined();
      expect(data?.typeIcon).toBeUndefined();
    });
  });

  describe('the Body', () => {
    it('with ciao mondo, a note shows the Occurrences of both words and no Preview', async () => {
      const app = fakeApp({ 'greeting.md': { content: 'ciao a tutti\n\nil mondo intero' } });

      const data = (await search(app, 'ciao mondo', { withIndex: true })).get('greeting.md');

      expect(data?.snippetWords).toEqual(['ciao', 'mondo']);
      expect(data?.renderPreview).toBe(false);
    });

    it('a note showing Occurrences offers its Preview on request', async () => {
      const app = fakeApp({ 'greeting.md': { content: 'ciao a tutti' } });

      const data = (await search(app, 'ciao', { withIndex: true })).get('greeting.md');

      expect(data?.offersPreview).toBe(true);
    });

    it('with a misspelt word, the Occurrences look for the word the search accepted', async () => {
      const app = fakeApp({ 'layers.md': { content: 'Notes on software architettura and layers' } });

      const data = (await search(app, 'architetura', { withIndex: true })).get('layers.md');

      expect(data?.snippetWords).toEqual(['architettura']);
    });

    it('with the start of a word, the Occurrences look for the full word', async () => {
      const app = fakeApp({ 'recipe.md': { content: 'pasta al pomodoro' } });

      const data = (await search(app, 'pomo', { withIndex: true })).get('recipe.md');

      expect(data?.snippetWords).toEqual(['pomodoro']);
    });

    it('without free text, a note shows its Preview and no Occurrences', async () => {
      const app = fakeApp({ 'alpha.md': ALPHA });

      const data = (await search(app, '#idea')).get('alpha.md');

      expect(data?.snippetWords).toEqual([]);
      expect(data?.renderPreview).toBe(true);
    });

    it('an Excalidraw drawing found by free text shows its Preview, not Occurrences', async () => {
      const app = fakeApp({
        'sketch.md': { content: 'ciao drawing data', cache: { frontmatter: { 'excalidraw-plugin': 'parsed' } } },
      });

      const data = (await search(app, 'ciao', { withIndex: true })).get('sketch.md');

      expect(data?.snippetWords).toEqual([]);
      expect(data?.renderPreview).toBe(true);
    });

    it('with task:, a note shows the lines of its tasks and no Preview', async () => {
      const app = fakeApp({ 'alpha.md': ALPHA });

      const data = (await search(app, 'task:')).get('alpha.md');

      expect(data?.taskLines).toEqual([
        { line: 1, done: false },
        { line: 2, done: true },
        { line: 3, done: false },
      ]);
      expect(data?.snippetWords).toEqual([]);
      expect(data?.renderPreview).toBe(false);
      expect(data?.offersPreview).toBe(false);
    });

    it('with task-todo:, a note shows only the lines of its open tasks', async () => {
      const app = fakeApp({ 'alpha.md': ALPHA });

      const data = (await search(app, 'task-todo:')).get('alpha.md');

      expect(data?.taskLines).toEqual([{ line: 1, done: false }, { line: 3, done: false }]);
    });

    it('with ciao task:, a note shows both its Occurrences and its task lines', async () => {
      const app = fakeApp({ 'alpha.md': ALPHA });

      const data = (await search(app, 'ciao task:', { withIndex: true })).get('alpha.md');

      expect(data?.snippetWords).toEqual(['ciao']);
      expect(data?.taskLines.map(t => t.line)).toEqual([1, 2, 3]);
    });

    it('without a task filter, a note shows no task lines', async () => {
      const app = fakeApp({ 'alpha.md': ALPHA });

      const data = (await search(app, '#idea')).get('alpha.md');

      expect(data?.taskLines).toEqual([]);
    });

    it('a non-markdown file found by free text shows its Preview, not Occurrences', async () => {
      const app = fakeApp({ 'ciao-diagram.png': {} });

      const data = (await search(app, 'ciao', { withIndex: true })).get('ciao-diagram.png');

      expect(data?.snippetWords).toEqual([]);
      expect(data?.renderPreview).toBe(true);
      expect(data?.offersPreview).toBe(false);
    });
  });
});
