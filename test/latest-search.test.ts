import { TFile } from 'obsidian';
import { LatestSearch } from '../src/engine/LatestSearch';
import { SearchResult } from '../src/Finder';

/* eslint-disable @typescript-eslint/no-explicit-any */

beforeAll(() => {
  (globalThis as any).window = { setTimeout, clearTimeout };
});

afterAll(() => {
  delete (globalThis as any).window;
});

function fakeFile(path: string): TFile {
  return { path } as unknown as TFile;
}

/** A search source whose answer for each query arrives only when the test releases it. */
function controlledSource() {
  const pending = new Map<string, (results: SearchResult[]) => void>();
  const source = {
    getResults: (query: string) => new Promise<SearchResult[]>((resolve) => pending.set(query, resolve)),
  };

  return { source, release: (query: string) => pending.get(query)?.([fakeFile(query)]) };
}

/** Lets timers and promise callbacks queued so far run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 5));

/** Resolves to the value if the promise settles before the flush, otherwise to 'pending'. */
async function settledOrPending<T>(promise: Promise<T>): Promise<T | 'pending'> {
  return Promise.race([promise, flush().then(() => 'pending' as const)]);
}

describe('LatestSearch', () => {
  it('resolves the latest search with its own results', async () => {
    const { source, release } = controlledSource();
    const search = new LatestSearch(source, 0);

    const spring = search.run('spring');

    await flush();
    release('spring');

    expect(await spring).toEqual([fakeFile('spring')]);
  });

  it('never settles a superseded search that finishes after the newer one', async () => {
    const { source, release } = controlledSource();
    const search = new LatestSearch(source, 0);

    const spri = search.run('spri');

    await flush();
    const spring = search.run('spring');

    await flush();
    release('spring');
    release('spri');

    expect(await spring).toEqual([fakeFile('spring')]);
    expect(await settledOrPending(spri)).toBe('pending');
  });

  it('never settles the search in flight when cancelled', async () => {
    const { source, release } = controlledSource();
    const search = new LatestSearch(source, 0);

    const spring = search.run('spring');

    await flush();
    search.cancel();
    release('spring');

    expect(await settledOrPending(spring)).toBe('pending');
  });
});
