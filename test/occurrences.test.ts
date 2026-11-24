import { bodyText, findOccurrences, Passage } from "../src/engine/occurrences";

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

    const body = bodyText(lines, ['ciao'], taskLines, { maxTasks: Infinity });

    expect(body.tasks.map(task => task.text)).toEqual(['task 0 ciao', 'task 1 ciao', 'task 2 ciao', 'task 3 ciao', 'task 4 ciao']);
    expect(body.hiddenTasks).toBe(0);
    expect(body.passages).toEqual([]);
  });
});
