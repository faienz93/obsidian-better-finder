import { bodyText, findOccurrences, HighlightPassage, Passage } from "../src/engine/occurrences";
import { HighlightCriterion } from "../src/engine/search-filters/types";

/** A passage as the user reads it: searched words in [brackets], cut context as an ellipsis. */
function show(passage: Passage): string {
  let out = '';
  let pos = 0;

  for (const [start, end] of passage.highlights) {
    out += `${passage.text.slice(pos, start)}[${passage.text.slice(start, end)}]`;
    pos = end;
  }

  out += passage.text.slice(pos);

  return `${passage.cutStart ? '… ' : ''}${out}${passage.cutEnd ? ' …' : ''}`;
}

describe('findOccurrences: where the searched words appear', () => {
  it('gives no passage when no word appears', () => {
    expect(findOccurrences('pasta al pomodoro', ['ciao'])).toEqual([]);
  });

  it('finds the word on lines 1, 7 and 10, one passage each', () => {
    const text = [
      'ciao a tutti', '', 'seconda parte', '', '', '', 'di nuovo ciao', 'altro', '', 'ciao finale',
    ].join('\n');

    const passages = findOccurrences(text, ['ciao']);

    expect(passages.map(p => p.line)).toEqual([0, 6, 9]);
    expect(passages.map(show)).toEqual(['[ciao] a tutti', 'di nuovo [ciao]', '[ciao] finale']);
  });

  it('keeps five words of context on each side, cut at word boundaries', () => {
    const text = 'uno due tre quattro cinque sei sette otto ciao nove dieci undici dodici tredici quattordici';

    expect(findOccurrences(text, ['ciao']).map(show)).toEqual([
      '… quattro cinque sei sette otto [ciao] nove dieci undici dodici tredici …',
    ]);
  });

  it('never takes context past the line of the occurrence', () => {
    const text = 'riga sopra lunga lunga\nsette otto ciao nove\nriga sotto lunga lunga';

    expect(findOccurrences(text, ['ciao']).map(show)).toEqual(['sette otto [ciao] nove']);
  });

  it('merges occurrences whose context touches into one passage', () => {
    const text = 'ciao a b c d e f g h i j ciao k';

    expect(findOccurrences(text, ['ciao']).map(show)).toEqual(['[ciao] a b c d e f g h i j [ciao] k']);
  });

  it('keeps occurrences apart when their contexts do not touch', () => {
    const text = 'ciao a b c d e f g h i j k ciao';

    expect(findOccurrences(text, ['ciao']).map(show)).toEqual(['[ciao] a b c d e …', '… g h i j k [ciao]']);
  });

  it('looks for each word on its own and keeps them in reading order', () => {
    const text = 'il mondo dice\n\nrighe in mezzo\n\nciao a tutti, mondo';

    expect(findOccurrences(text, ['ciao', 'mondo']).map(show)).toEqual([
      'il [mondo] dice',
      '[ciao] a tutti, [mondo]',
    ]);
  });

  it('matches whatever the case of the text and of the word', () => {
    expect(findOccurrences('Ciao a TUTTI', ['ciao', 'Tutti']).map(show)).toEqual(['[Ciao] a [TUTTI]']);
  });

  it('includes the whole word around a partial match', () => {
    expect(findOccurrences('la architettura del sistema', ['tett']).map(show)).toEqual([
      'la archi[tett]ura del sistema',
    ]);
  });
});

describe('bodyText: Occurrences and task lines together', () => {
  const NOTE = '- [ ] ciao a Marco\n- [x] scrivere il piano\nciao da alpha';

  it('shows a task line containing the word once, as a task with the word highlighted', () => {
    const body = bodyText(NOTE, ['ciao'], [{ line: 0, done: false }, { line: 1, done: true }]);

    expect(body.passages.map(show)).toEqual(['[ciao] da alpha']);
    expect(body.tasks.map(task => `${task.done ? 'x' : ' '} ${show({ ...task, line: 0, cutStart: false, cutEnd: false })}`))
      .toEqual(['  [ciao] a Marco', 'x scrivere il piano']);
  });

  it('shows the first task lines and counts the others', () => {
    const lines = Array.from({ length: 5 }, (_, i) => `- [ ] task ${i}`).join('\n');
    const taskLines = [0, 1, 2, 3, 4].map(line => ({ line, done: false }));

    const body = bodyText(lines, [], taskLines);

    expect(body.tasks.map(task => task.text)).toEqual(['task 0', 'task 1', 'task 2']);
    expect(body.hiddenTasks).toBe(2);
  });

  it('shows every task line on a Card, which scrolls instead of counting', () => {
    const lines = Array.from({ length: 5 }, (_, i) => `- [ ] task ${i} ciao`).join('\n');
    const taskLines = [0, 1, 2, 3, 4].map(line => ({ line, done: false }));

    const body = bodyText(lines, ['ciao'], taskLines, undefined, { maxTasks: Infinity });

    expect(body.tasks.map(task => task.text)).toEqual(['task 0 ciao', 'task 1 ciao', 'task 2 ciao', 'task 3 ciao', 'task 4 ciao']);
    expect(body.hiddenTasks).toBe(0);
    expect(body.passages).toEqual([]);
  });
});

describe('bodyText: Highlights under the highlight filter', () => {
  const ANY: HighlightCriterion = { colours: [] };

  /** A Highlight passage as the user reads it: each Highlight in [brackets], cut context as an ellipsis. */
  function showHighlights(passage: HighlightPassage): string {
    return show({ ...passage, highlights: passage.highlights.map((h): [number, number] => [h.start, h.end]) });
  }

  it('shows each Highlight of the note without its == marks', () => {
    const body = bodyText('intro\nsome ==important== text\nplain line', [], [], ANY);

    expect(body.highlights.map(showHighlights)).toEqual(['some [important] text']);
    expect(body.highlights.map(h => h.line)).toEqual([1]);
  });

  it('with a word, shows only the Highlights containing it, the other == marks dropped', () => {
    const note = 'read ==Kafka streams== and ==Docker== today\n==kafkaesque== story\n==docker== only';

    const body = bodyText(note, [], [], { colours: [], word: 'kafka' });

    expect(body.highlights.map(showHighlights)).toEqual(['read [Kafka streams] and Docker today']);
  });

  it('keeps five words of context on each side of a Highlight', () => {
    const note = 'uno due tre quattro cinque sei sette ==otto ciao== nove dieci undici dodici tredici quattordici';

    expect(bodyText(note, [], [], ANY).highlights.map(showHighlights)).toEqual([
      '… tre quattro cinque sei sette [otto ciao] nove dieci undici dodici tredici …',
    ]);
  });

  it('merges Highlights whose context touches into one passage', () => {
    expect(bodyText('==a== b c ==d== e', [], [], ANY).highlights.map(showHighlights)).toEqual(['[a] b c [d] e']);
  });

  it('shows the first Highlight passages and counts the others', () => {
    const note = Array.from({ length: 5 }, (_, i) => `line ==mark ${i}==`).join('\n');

    const body = bodyText(note, [], [], ANY);

    expect(body.highlights.map(showHighlights)).toEqual(['line [mark 0]', 'line [mark 1]', 'line [mark 2]']);
    expect(body.hiddenHighlights).toBe(2);
  });

  it('caps and counts Highlights, not passages, when a passage holds several', () => {
    const note = ['==a== and ==b==', '==c==', '==d==', '==e==', 'two ==f== and ==g=='].join('\n');

    const body = bodyText(note, [], [], ANY);

    expect(body.highlights.map(showHighlights)).toEqual(['[a] and [b]', '[c]']);
    expect(body.hiddenHighlights).toBe(4);
  });

  it('shows every Highlight on a Card, which scrolls instead of counting', () => {
    const note = Array.from({ length: 5 }, (_, i) => `line ==mark ${i}==`).join('\n');

    const body = bodyText(note, [], [], ANY, { maxHighlights: Infinity });

    expect(body.highlights).toHaveLength(5);
    expect(body.hiddenHighlights).toBe(0);
  });

  it('shows Highlights, task lines and Occurrences together, never the same line twice', () => {
    const note = [
      '- [ ] ==ciao== Marco',
      '- [ ] scrivere a Luca',
      'ciao da ==alpha==',
      'ciao di nuovo',
    ].join('\n');

    const body = bodyText(note, ['ciao'], [{ line: 0, done: false }, { line: 1, done: false }], ANY);

    expect(body.highlights.map(h => h.line)).toEqual([0, 2]);
    expect(body.tasks.map(task => task.text)).toEqual(['scrivere a Luca']);
    expect(body.hiddenTasks).toBe(0);
    expect(body.passages.map(p => p.line)).toEqual([3]);
  });

  it('never repeats a Highlight line left out by the cap as an Occurrence', () => {
    const note = Array.from({ length: 4 }, (_, i) => `line ==kafka ${i}== end`).join('\n');
    const body = bodyText(note, ['kafka'], [], { colours: [], word: 'kafka' });

    expect(body.highlights.map(h => h.line)).toEqual([0, 1, 2]);
    expect(body.hiddenHighlights).toBe(1);
    expect(body.passages).toEqual([]);
  });

  it('skips a Highlight with nothing but spaces in it', () => {
    expect(bodyText('==   ==\nsome ==important== text', [], [], ANY).highlights.map(showHighlights)).toEqual([
      'some [important] text',
    ]);
  });

  it('shows no Highlights without the highlight filter', () => {
    expect(bodyText('some ==important== text', [], []).highlights).toEqual([]);
  });

  it('gives each Highlight its colour and leaves the colour emoji out of the text', () => {
    const body = bodyText('a ==🔴red one== and ==🔵blue one== and ==plain one==', [], [], ANY);

    expect(body.highlights.map(showHighlights)).toEqual(['a [red one] and [blue one] and [plain one]']);
    expect(body.highlights[0].highlights.map(highlight => highlight.colour)).toEqual(['red', 'blue', undefined]);
  });

  it('marks only the Highlights of the colours asked for, the others without == or emoji', () => {
    const note = ['a ==🔴kafka== and ==🔵kafka== here', '==🟢kafka== alone', '==🔵other== too'].join('\n');
    const body = bodyText(note, [], [], { colours: ['red', 'green'], word: 'kafka' });

    expect(body.highlights.map(showHighlights)).toEqual(['a [kafka] and kafka here', '[kafka] alone']);
    expect(body.highlights.flatMap(h => h.highlights.map(highlight => highlight.colour))).toEqual(['red', 'green']);
  });

  /** A Highlight passage with only its searched words in [brackets]. */
  function showOccurrences(passage: HighlightPassage): string {
    return show({ ...passage, highlights: passage.occurrences });
  }

  it('marks the searched words on a Highlight line, beside and inside the Highlight', () => {
    const body = bodyText('read ==kafka streams== in docker today', ['docker', 'streams'], [], { colours: [], word: 'kafka' });

    expect(body.highlights.map(showHighlights)).toEqual(['read [kafka streams] in docker today']);
    expect(body.highlights.map(showOccurrences)).toEqual(['read kafka [streams] in [docker] today']);
    expect(body.passages).toEqual([]);
  });

  it('shows a searched word far from the Highlight on its line, in a passage of its own', () => {
    const note = '==kafka== uno due tre quattro cinque sei sette otto nove dieci undici dodici docker end';

    const body = bodyText(note, ['docker'], [], { colours: [], word: 'kafka' });

    expect(body.highlights.map(showOccurrences)).toEqual([
      'kafka uno due tre quattro cinque …',
      '… otto nove dieci undici dodici [docker] end',
    ]);
    expect(body.hiddenHighlights).toBe(0);
    expect(body.passages).toEqual([]);
  });

  it('shows no Highlight passage for a searched word on a line whose Highlights do not match', () => {
    const body = bodyText('==other== and docker', ['docker'], [], { colours: [], word: 'kafka' });

    expect(body.highlights).toEqual([]);
  });

  it('shows no Highlight without an emoji under a colour key', () => {
    expect(bodyText('a ==kafka== note', [], [], { colours: ['red'] }).highlights).toEqual([]);
  });
});
