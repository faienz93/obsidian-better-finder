import { TFile } from "obsidian";
import { Finder, SearchResult } from "../src/Finder";
import { SearchUIHelper } from "../src/SearchUIHelper";
import { fakeApp, FakeNote, resetCommonCaches } from "./helpers/fakeVault";

const paths = (results: SearchResult[]) => results.map(r => (r as TFile).path).sort();

async function search(vault: Record<string, FakeNote | string>, query: string): Promise<string[]> {
  const outcome = await new Finder(fakeApp(vault)).getResults(query);

  return paths(outcome.results);
}

describe('Finder.getResults: highlight filter', () => {
  beforeEach(() => {
    resetCommonCaches();
  });

  it('keeps only the notes with a Highlight for a bare highlight key', async () => {
    const vault = {
      'marked.md': 'some ==important== text',
      'plain.md': 'nothing marked here',
    };

    expect(await search(vault, 'highlight:')).toEqual(['marked.md']);
  });

  it('keeps only the notes with a Highlight after a click on the highlight Filter chip', async () => {
    const vault = {
      'marked.md': 'some ==important== text',
      'plain.md': 'nothing marked here',
    };

    expect(await search(vault, SearchUIHelper.toggleFilter('', 'highlight:'))).toEqual(['marked.md']);
  });

  it('keeps the notes with the word inside a Highlight, as a whole word and in any case', async () => {
    const vault = {
      'streams.md': 'read about ==Kafka streams== today',
      'kafkaesque.md': 'a ==kafkaesque== story',
      'unmarked.md': 'kafka without a Highlight, ==other== marked',
    };

    expect(await search(vault, 'highlight:kafka')).toEqual(['streams.md']);
  });

  it('matches a quoted phrase inside a Highlight', async () => {
    const vault = {
      'phrase.md': 'on ==event sourcing and CQRS==',
      'apart.md': 'on ==event== and ==sourcing==',
    };

    expect(await search(vault, 'highlight:"event sourcing"')).toEqual(['phrase.md']);
  });

  it('lets a bare highlight key take the next word as its value', async () => {
    const vault = {
      'kafka.md': '==kafka== notes',
      'other.md': '==other== notes about kafka',
    };

    expect(await search(vault, 'highlight: kafka')).toEqual(['kafka.md']);
  });

  it('narrows further by the free text next to it', async () => {
    const vault = {
      'both.md': '==kafka== running in docker',
      'highlight-only.md': '==kafka== on bare metal',
      'text-only.md': 'kafka in docker, nothing marked',
    };

    expect(await search(vault, 'highlight:kafka docker')).toEqual(['both.md']);
  });

  it.each(['Highlight:kafka', 'HIGHLIGHT:kafka'])('reads %j like highlight:kafka', async (query) => {
    const vault = {
      'kafka.md': '==kafka== notes',
      'other.md': '==other== notes',
    };

    expect(await search(vault, query)).toEqual(['kafka.md']);
  });

  it('counts a Highlight only when it opens and closes on the same line', async () => {
    const vault = {
      'one-line.md': 'a ==kafka== line',
      'two-lines.md': 'a stray == opens here\nand kafka closes == there',
    };

    expect(await search(vault, 'highlight:')).toEqual(['one-line.md']);
    expect(await search(vault, 'highlight:kafka')).toEqual(['one-line.md']);
  });

  it('never matches an Excalidraw drawing or a non-markdown file', async () => {
    const vault = {
      'note.md': '==kafka== notes',
      'drawing.md': { content: '==kafka== in the scene', cache: { frontmatter: { 'excalidraw-plugin': 'parsed' } } },
      'board.canvas': '{"text": "==kafka=="}',
      'data.json': '{"text": "==kafka=="}',
    };

    expect(await search(vault, 'highlight:')).toEqual(['note.md']);
    expect(await search(vault, 'highlight:kafka')).toEqual(['note.md']);
  });
});
