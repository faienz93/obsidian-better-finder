import { App, TFile } from "obsidian";
import { Finder } from "../src/Finder";
import { buildResultData, ResultData } from "../src/engine/ResultData";
import { CanvasTagCache } from "../src/engine/CanvasTagCache";

/* eslint-disable @typescript-eslint/no-explicit-any */

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
async function search(app: App, query: string): Promise<Map<string, ResultData>> {
  const outcome = await new Finder(app).getResults(query);
  const dataByPath = new Map<string, ResultData>();

  for (const result of outcome.results) {
    const file = result as TFile;

    dataByPath.set(file.path, buildResultData(app, file, outcome));
  }

  return dataByPath;
}

const ALPHA = {
  cache: {
    tags: ['#project/alpha', '#idea'],
    listItems: [{ task: ' ' }, { task: 'x' }, { task: ' ' }],
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
});
