import { App } from "obsidian";
import { TaskFilter } from "../src/engine/search-filters/TaskFilter";
import { TagsFilter } from "../src/engine/search-filters/TagsFilter";
import { NegationFilter } from "../src/engine/search-filters/NegationFilter";
import { MetadataFilter } from "../src/engine/search-filters/MetadataFilter";
import { fakeApp, fakeFile } from "./helpers/fakeVault";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---- helpers -------------------------------------------------------------

/** An App whose metadata cache is the one given per path. */
function appWithCaches(cacheByPath: Record<string, any>): App {
  return fakeApp(Object.fromEntries(Object.entries(cacheByPath).map(([path, cache]) => [path, { cache }])));
}

// ---- TaskFilter (bug B4) --------------------------------------------------

describe('TaskFilter', () => {
  const filter = new TaskFilter();

  it('filtra i file con task nello stato richiesto', () => {
    const files = [fakeFile('con-todo.md'), fakeFile('senza-task.md'), fakeFile('done.md')];
    const app = appWithCaches({
      'con-todo.md': { listItems: [{ task: ' ' }] },
      'senza-task.md': { listItems: [] },
      'done.md': { listItems: [{ task: 'x' }] },
    });

    expect(filter.filter(files, 'all', app).map(f => f.path)).toEqual(['con-todo.md', 'done.md']);
    expect(filter.filter(files, 'todo', app).map(f => f.path)).toEqual(['con-todo.md']);
    expect(filter.filter(files, 'done', app).map(f => f.path)).toEqual(['done.md']);
  });
});

// ---- TagsFilter (bug B2, B3) ----------------------------------------------

describe('TagsFilter', () => {
  const filter = new TagsFilter();

  it('NON matcha tag cugini con trattino (B2: #prompt ≠ #prompt-engineering)', () => {
    const files = [fakeFile('a.md'), fakeFile('b.md')];
    const app = appWithCaches({
      'a.md': { tags: ['#prompt'] },
      'b.md': { tags: ['#prompt-engineering'] },
    });

    expect(filter.filter(files, ['#prompt'], app).map(f => f.path)).toEqual(['a.md']);
  });

  it('matcha la gerarchia con lo slash (#tag/figlio)', () => {
    const files = [fakeFile('a.md')];
    const app = appWithCaches({ 'a.md': { tags: ['#prompt/tecniche'] } });

    expect(filter.filter(files, ['#prompt'], app)).toHaveLength(1);
  });

  it('matcha tag maiuscoli nei file (B3: #WAF)', () => {
    const files = [fakeFile('waf.md')];
    const app = appWithCaches({ 'waf.md': { tags: ['#WAF'] } });

    expect(filter.filter(files, ['#waf'], app)).toHaveLength(1);
  });

  it('esclude gli archiviati salvo richiesta esplicita (#archive)', () => {
    const files = [fakeFile('vivo.md'), fakeFile('archiviato.md')];
    const app = appWithCaches({
      'vivo.md': { tags: ['#x'] },
      'archiviato.md': { tags: ['#archive'] },
    });

    expect(filter.excludeArchived(files, [], app).map(f => f.path)).toEqual(['vivo.md']);
    expect(filter.excludeArchived(files, ['#archive'], app)).toHaveLength(2);
  });
});

// ---- NegationFilter ---------------------------------------------------------

describe('NegationFilter', () => {
  const filter = new NegationFilter();

  it('esclude i file per estensione e per tag', () => {
    const files = [fakeFile('img.png'), fakeFile('nota.md'), fakeFile('draft.md')];
    const app = appWithCaches({
      'nota.md': { tags: ['#x'] },
      'draft.md': { tags: ['#draft'] },
    });

    const result = filter.filter(files, { extensions: ['png'], tags: ['#draft'] }, app);

    expect(result.map(f => f.path)).toEqual(['nota.md']);
  });
});

// ---- MetadataFilter ---------------------------------------------------------

describe('MetadataFilter', () => {
  const filter = new MetadataFilter();

  it('matcha frontmatter con valori stringa e array', () => {
    const files = [fakeFile('a.md'), fakeFile('b.md'), fakeFile('c.md')];
    const app = appWithCaches({
      'a.md': { frontmatter: { author: 'Mario Rossi' } },
      'b.md': { frontmatter: { author: ['Verdi', 'Rossi'] } },
      'c.md': { frontmatter: { author: 'Bianchi' } },
    });

    const result = filter.filter(files, [{ key: 'author', value: 'rossi' }], app);

    expect(result.map(f => f.path)).toEqual(['a.md', 'b.md']);
  });
});
