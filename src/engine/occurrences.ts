import { TaskLine } from "./ResultData";

/** Words of context kept on each side of an occurrence. */
export const OCCURRENCE_CONTEXT_WORDS = 5;

/** Task lines a Body shows before counting the others. */
export const MAX_TASK_LINES = 3;

/** One passage of a note around one or more searched words, never longer than its line. */
export interface Passage {
  /** Zero-based line of the note the passage comes from. */
  line: number;
  text: string;
  /** Start and end offsets in `text` of each searched word, in order. */
  highlights: Array<[number, number]>;
  /** The line goes on before the passage. */
  cutStart: boolean;
  /** The line goes on after the passage. */
  cutEnd: boolean;
}

/** A task line as the Body shows it: its text without the checkbox, searched words highlighted. */
export interface TaskText {
  done: boolean;
  text: string;
  highlights: Array<[number, number]>;
}

/** The text a Body draws from a note: its Occurrences and its task lines, never the same line twice. */
export interface BodyText {
  passages: Passage[];
  tasks: TaskText[];
  /** Task lines left out after the first `maxTasks`. */
  hiddenTasks: number;
}

interface Span {
  start: number;
  end: number;
}

export function findOccurrences(text: string, words: string[]): Passage[] {
  return passagesIn(text.split('\n'), wordsPattern(words));
}

export function bodyText(
  content: string,
  words: string[],
  taskLines: TaskLine[],
  { maxTasks = MAX_TASK_LINES }: { maxTasks?: number } = {}
): BodyText {
  const lines = content.split('\n');
  const pattern = wordsPattern(words);
  const shown = taskLines.slice(0, maxTasks);
  const shownLineNumbers = new Set(shown.map(task => task.line));
  const tasks = shown
    .map(task => {
      const text = taskText(lines[task.line] ?? '');
      const highlights = pattern ? matchSpans(text, pattern).map((m): [number, number] => [m.start, m.end]) : [];

      return { done: task.done, text, highlights };
    })
    .filter(task => task.text.length > 0);

  return {
    // A task line shown below carries its own highlight: it is never repeated as an Occurrence.
    passages: passagesIn(lines, pattern).filter(p => !shownLineNumbers.has(p.line)),
    tasks,
    hiddenTasks: taskLines.length - shown.length,
  };
}

function passagesIn(lines: string[], pattern: RegExp | null): Passage[] {
  const passages: Passage[] = [];

  if (!pattern) return passages;

  lines.forEach((lineText, line) => {
    const matches = matchSpans(lineText, pattern);

    if (matches.length === 0) return;

    const tokens = matchSpans(lineText, /\S+/g);
    const windows: Array<{ from: number; to: number; matches: Span[] }> = [];

    for (const match of matches) {
      const first = tokens.findIndex(t => t.end > match.start);
      let last = first;

      while (last + 1 < tokens.length && tokens[last + 1].start < match.end) last++;
      const from = Math.max(0, first - OCCURRENCE_CONTEXT_WORDS);
      const to = Math.min(tokens.length - 1, last + OCCURRENCE_CONTEXT_WORDS);
      const previous = windows[windows.length - 1];

      // Contexts touch when no word lies between them.
      if (previous && from <= previous.to + 1) {
        previous.to = Math.max(previous.to, to);
        previous.matches.push(match);
      } else {
        windows.push({ from, to, matches: [match] });
      }
    }

    for (const { from, to, matches: inWindow } of windows) {
      const offset = tokens[from].start;

      passages.push({
        line,
        text: lineText.slice(offset, tokens[to].end),
        highlights: inWindow.map(m => [m.start - offset, m.end - offset]),
        cutStart: from > 0,
        cutEnd: to < tokens.length - 1,
      });
    }
  });

  return passages;
}

/** The text of a task line without its list marker and checkbox. */
function taskText(lineText: string): string {
  return lineText.replace(/^\s*(?:[-*+]|\d+\.)\s*\[.\]\s*/, '').trim();
}

function matchSpans(lineText: string, pattern: RegExp): Span[] {
  return [...lineText.matchAll(pattern)].map(m => ({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
}

/** One case-insensitive pattern for all the words, longest first so a word wins over its own prefix. */
function wordsPattern(words: string[]): RegExp | null {
  const alternatives = words
    .filter(word => word.length > 0)
    .sort((a, b) => b.length - a.length)
    .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  return alternatives.length > 0 ? new RegExp(alternatives.join('|'), 'gi') : null;
}
