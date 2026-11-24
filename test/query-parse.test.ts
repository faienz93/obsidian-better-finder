import { SearchStrategyFactory, ParsedQuery } from "../src/engine/SearchStrategy";

// Pins what each Query parses to, so the parser can be rewritten without changing a search.

const IMAGE_TYPES = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

/** The fields a Query set, without the empty defaults, and free text with collapsed spaces. */
function parse(query: string): Partial<ParsedQuery> {
  const parsed: Partial<ParsedQuery> = { ...SearchStrategyFactory.getInstance().parse(query) };

  delete parsed.rawInput;
  parsed.freeText = parsed.freeText?.replace(/\s+/g, ' ');

  for (const key of Object.keys(parsed) as Array<keyof ParsedQuery>) {
    const value = parsed[key];

    if (value === undefined || value === false || (Array.isArray(value) && value.length === 0)) {
      delete parsed[key];
    }
  }

  if (parsed.negations && parsed.negations.extensions.length === 0 && parsed.negations.tags.length === 0) {
    delete parsed.negations;
  }

  return parsed;
}

describe('parse: free text', () => {
  it.each([
    ['spring', 'spring'],
    ['  spring  boot ', 'spring boot'],
    ['this-week', 'this-week'],
    ['e-mail', 'e-mail'],
    ['x -', 'x -'],
    ['-', '-'],
    ['a > b', 'a > b'],
    ['https://x.com', 'https://x.com'],
    ['a:/b', 'a:/b'],
    ['"exact phrase" x', '"exact phrase" x'],
  ])('%j is free text only', (query, freeText) => {
    expect(parse(query)).toEqual({ freeText });
  });
});

describe('parse: command mode', () => {
  it.each([
    ['> toggle', 'toggle'],
    ['>', ''],
    [' >x', 'x'],
  ])('%j runs commands matching %j', (query, commandText) => {
    expect(parse(query)).toEqual({ isCommandMode: true, commandText, freeText: '' });
  });
});

describe('parse: tags', () => {
  it('keeps every tag, lowercased, nested ones included', () => {
    expect(parse('#spring #Java/Core boot')).toEqual({ tags: ['#spring', '#java/core'], freeText: 'boot' });
  });
});

describe('parse: dates', () => {
  it.each([
    ['created:today x', { field: 'created', value: 'today' }, 'x'],
    ['created: today x', { field: 'created', value: 'today' }, 'x'],
    ['modified:2024-01-02', { field: 'modified', value: '2024-01-02' }, ''],
    ['created:2024', { field: 'created', value: '2024' }, ''],
  ])('%j', (query, dateFilter, freeText) => {
    expect(parse(query)).toEqual({ dateFilter, freeText });
  });

  it('drops a value glued to the key that is not a date', () => {
    expect(parse('created:foo x')).toEqual({ freeText: 'x' });
  });

  it('keeps a word after the space as free text when it is not a date', () => {
    expect(parse('created: foo')).toEqual({ freeText: 'foo' });
  });

  it('drops a bare date key', () => {
    expect(parse('created:')).toEqual({ freeText: '' });
  });

  it.each([
    'modified:today created:yesterday',
    'created:yesterday modified:today',
  ])('modified wins over created wherever it is: %j', (query) => {
    expect(parse(query)).toEqual({ dateFilter: { field: 'modified', value: 'today' }, freeText: '' });
  });
});

describe('parse: file types', () => {
  it.each([
    ['pdf x', ['.pdf'], 'x'],
    ['PDF', ['.pdf'], ''],
    ['image', IMAGE_TYPES, ''],
    ['img png', IMAGE_TYPES, ''],
    ['canvas json base', ['.canvas', '.json', '.base'], ''],
    ['excalidraw', ['excalidraw'], ''],
  ])('%j', (query, fileTypes, freeText) => {
    expect(parse(query)).toEqual({ fileTypes, freeText });
  });
});

describe('parse: scope', () => {
  it.each([
    ['title:foo bar', 'foo bar'],
    ['title: foo', 'foo'],
  ])('%j narrows to titles and keeps the term as free text', (query, freeText) => {
    expect(parse(query)).toEqual({ scope: 'title', freeText });
  });

  it('drops a bare title key', () => {
    expect(parse('title:')).toEqual({ freeText: '' });
  });

  it('reads a key that only ends in title as a property', () => {
    expect(parse('subtitle:x')).toEqual({ metadataFilters: [{ key: 'subtitle', value: 'x' }], freeText: '' });
  });
});

describe('parse: tasks', () => {
  it.each([
    ['task:', 'all', ''],
    ['task: ', 'all', ''],
    ['task-todo: x', 'todo', 'x'],
    ['task-done:', 'done', ''],
  ])('%j', (query, taskFilter, freeText) => {
    expect(parse(query)).toEqual({ taskFilter, freeText });
  });

  it('never takes a value: the word glued to task: is free text', () => {
    expect(parse('task:foo')).toEqual({ taskFilter: 'all', freeText: 'foo' });
  });
});

describe('parse: path', () => {
  it.each([
    'path:Work x',
    'path: Work x',
  ])('%j', (query) => {
    expect(parse(query)).toEqual({ pathFilter: 'work', freeText: 'x' });
  });
});

describe('parse: highlight', () => {
  it.each([
    ['highlight:word x', 'word'],
    ['highlight:"two words" x', 'two words'],
  ])('%j', (query, highlightFilter) => {
    expect(parse(query)).toEqual({ highlightFilter, freeText: 'x' });
  });

  it('drops a bare highlight key', () => {
    expect(parse('highlight:')).toEqual({ freeText: '' });
  });
});

describe('parse: properties', () => {
  it('reads unclaimed keys as lowercased properties', () => {
    expect(parse('author:rossi status:Draft')).toEqual({
      metadataFilters: [{ key: 'author', value: 'rossi' }, { key: 'status', value: 'draft' }],
      freeText: '',
    });
  });

  it('accepts a dash inside the key', () => {
    expect(parse('reading-status:done')).toEqual({ metadataFilters: [{ key: 'reading-status', value: 'done' }], freeText: '' });
  });

  it('leaves reserved keys to their own filter', () => {
    expect(parse('created:today author:rossi')).toEqual({
      dateFilter: { field: 'created', value: 'today' },
      metadataFilters: [{ key: 'author', value: 'rossi' }],
      freeText: '',
    });
  });
});

describe('parse: negation', () => {
  it.each([
    ['-pdf x', ['pdf'], 'x'],
    ['-image', IMAGE_EXTENSIONS, ''],
    ['-docx', ['docx'], ''],
  ])('%j excludes extensions', (query, extensions, freeText) => {
    expect(parse(query)).toEqual({ negations: { extensions, tags: [] }, freeText });
  });

  it('tells an excluded tag from a searched one', () => {
    expect(parse('-#draft #keep')).toEqual({ tags: ['#keep'], negations: { extensions: [], tags: ['#draft'] }, freeText: '' });
  });
});

describe('parse: every filter at once', () => {
  it('splits each token to its filter and keeps the rest as free text', () => {
    expect(parse('#tag created:today pdf -image path:a task: author:x title:y highlight:z free')).toEqual({
      tags: ['#tag'],
      dateFilter: { field: 'created', value: 'today' },
      fileTypes: ['.pdf'],
      negations: { extensions: IMAGE_EXTENSIONS, tags: [] },
      pathFilter: 'a',
      taskFilter: 'all',
      metadataFilters: [{ key: 'author', value: 'x' }],
      scope: 'title',
      highlightFilter: 'z',
      freeText: 'y free',
    });
  });
});

describe('parse: a token is claimed whole', () => {
  it.each([
    ['c#sharp', 'c#sharp'],
    ['issue#12', 'issue#12'],
    ['#a,#b', '#a,#b'],
    ['pdf, x', 'pdf, x'],
    ['excalidraw-plugin', 'excalidraw-plugin'],
  ])('%j is free text', (query, freeText) => {
    expect(parse(query)).toEqual({ freeText });
  });

  it('leaves a negated key:value as free text until negation supports it', () => {
    expect(parse('-path:Archive x')).toEqual({ freeText: '-path:Archive x' });
  });
});

describe('parse: values', () => {
  it('drops a bare path key like every other key that needs a value', () => {
    expect(parse('path:')).toEqual({ freeText: '' });
  });

  it('reads a quoted folder with spaces', () => {
    expect(parse('path:"My Folder" x')).toEqual({ pathFilter: 'my folder', freeText: 'x' });
  });

  it('lets a bare highlight key take the next word', () => {
    expect(parse('highlight: word x')).toEqual({ highlightFilter: 'word', freeText: 'x' });
  });

  it('does not let a bare key take a word another Filter claims', () => {
    expect(parse('path: pdf')).toEqual({ fileTypes: ['.pdf'], freeText: '' });
  });

  it('reads a key in any case', () => {
    expect(parse('PATH:Work Highlight:x')).toEqual({ pathFilter: 'work', highlightFilter: 'x', freeText: '' });
  });
});

describe('activeHints', () => {
  const labels = (query: string) => SearchStrategyFactory.getInstance().activeHints(query).map(h => h.label);

  it('switches on the chip of every Filter the query uses', () => {
    expect(labels('#tag pdf author:rossi')).toEqual(['#', 'pdf', 'author:']);
  });

  it('switches on a key still waiting for its value', () => {
    expect(labels('path:')).toEqual(['path:']);
  });

  it('leaves the negation chip off for a dash inside a word', () => {
    expect(labels('created:this-week')).toEqual(['created:']);
  });

  it('switches on only the command chip in command mode', () => {
    expect(labels('> pdf')).toEqual(['>']);
  });
});
