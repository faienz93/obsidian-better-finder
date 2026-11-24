import { App, Command, TFile } from "obsidian";
import { CanvasTagCache } from "../../src/engine/CanvasTagCache";
import { SearchIndex } from "../../src/engine/SearchIndex";
import { XbergExtractor } from "../../src/engine/XbergExtractor";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * One file of a fake Vault. `cache` is what `metadataCache.getFileCache` returns: tags are plain
 * strings (`tags: ['#idea']`, as the `getAllTags` mock reads them), plus `frontmatter` and
 * `listItems` (`[{ task: ' ' }]`). A string stands for `{ content }`.
 */
export interface FakeNote {
  content?: string;
  cache?: any;
  mtime?: number;
}

export function fakeFile(path: string, mtime = 0): TFile {
  const name = path.split('/').pop() ?? path;

  return Object.assign(new TFile(), {
    path,
    basename: name.replace(/\.\w+$/, ''),
    extension: name.includes('.') ? name.split('.').pop() as string : '',
    parent: { path: path.split('/').slice(0, -1).join('/') },
    stat: { mtime, ctime: mtime },
  });
}

/**
 * An App over the files keyed by path in `vault`. It covers what search reaches, including the
 * canvas tag cache, which reads `.canvas` files through `cachedRead` the first time a Filter asks.
 */
export function fakeApp(vault: Record<string, FakeNote | string>, commands: Command[] = []): App {
  const notes = new Map(Object.entries(vault).map(([path, note]) => [path, typeof note === 'string' ? { content: note } : note]));
  const files = [...notes].map(([path, note]) => fakeFile(path, note.mtime));

  return {
    vault: {
      getFiles: () => files,
      getMarkdownFiles: () => files.filter(f => f.extension === 'md'),
      getAbstractFileByPath: (path: string) => files.find(f => f.path === path) ?? null,
      cachedRead: (file: TFile) => Promise.resolve(notes.get(file.path)?.content ?? ''),
      on: () => ({}),
      offref: () => undefined,
    },
    metadataCache: { getFileCache: (file: TFile) => notes.get(file.path)?.cache ?? null },
    commands: { listCommands: () => commands },
  } as unknown as App;
}

/** The common caches are singletons bound to the first App they see; call before each test. */
export function resetCommonCaches(): void {
  (SearchIndex as any)._instance = null;
  (CanvasTagCache as any)._instance = null;
  (XbergExtractor as any)._instance = null;
}
