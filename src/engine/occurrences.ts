import { TaskLine } from "./ResultData";
import { Highlight, highlightsIn, matchesHighlight } from "./search-filters/HighlightFilter";
import { HighlightCriterion } from "./search-filters/types";

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

/** A Highlight the Body marks, by its offsets in the passage text. */
export interface HighlightMark {
  start: number;
  end: number;
}

/**
 * One passage of a note around one or more Highlights the query asked for, never longer than its
 * line. The `==` marks of every Highlight on the line are left out of `text`.
 */
export interface HighlightPassage {
  /** Zero-based line of the note the passage comes from. */
  line: number;
  text: string;
  /** The Highlights in `text`, in order. */
  marks: HighlightMark[];
  /** The line goes on before the passage. */
  cutStart: boolean;
  /** The line goes on after the passage. */
  cutEnd: boolean;
}

/**
 * The text a Body draws from a note: its Highlights, its task lines and its Occurrences, in this
 * order, never the same line twice.
 */
export interface BodyText {
  highlights: HighlightPassage[];
  /** Highlight passages left out after the first `maxHighlights`. */
  hiddenHighlights: number;
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
  highlight?: HighlightCriterion,
  { maxTasks = MAX_TASK_LINES, maxHighlights = MAX_TASK_LINES }: { maxTasks?: number; maxHighlights?: number } = {}
): BodyText {
  const lines = content.split('\n');
  const pattern = wordsPattern(words);
  const allHighlights = highlight ? highlightPassagesIn(lines, highlight) : [];
  const shownHighlights = allHighlights.slice(0, maxHighlights);
  const highlightLineNumbers = new Set(shownHighlights.map(passage => passage.line));
  // A line shown as a Highlight carries its own mark: it is never repeated as a task line.
  const taskLinesLeft = taskLines.filter(task => !highlightLineNumbers.has(task.line));
  const shown = taskLinesLeft.slice(0, maxTasks);
  const shownLineNumbers = new Set([...highlightLineNumbers, ...shown.map(task => task.line)]);
  const tasks = shown
    .map(task => {
      const text = taskText(lines[task.line] ?? '');
      const highlights = pattern ? matchSpans(text, pattern).map((m): [number, number] => [m.start, m.end]) : [];

      return { done: task.done, text, highlights };
    })
    .filter(task => task.text.length > 0);

  return {
    highlights: shownHighlights,
    hiddenHighlights: allHighlights.length - shownHighlights.length,
    // A line shown above carries its own mark: it is never repeated as an Occurrence.
    passages: passagesIn(lines, pattern).filter(p => !shownLineNumbers.has(p.line)),
    tasks,
    hiddenTasks: taskLinesLeft.length - shown.length,
  };
}

/** The Highlights the criterion asks for, with context, in reading order. */
function highlightPassagesIn(lines: string[], criterion: HighlightCriterion): HighlightPassage[] {
  const byLine = new Map<number, Highlight[]>();

  for (const found of highlightsIn(lines.join('\n'))) {
    byLine.set(found.line, [...(byLine.get(found.line) ?? []), found]);
  }

  return [...byLine].flatMap(([line, onLine]) => {
    // The line as the note reads it: every Highlight on it loses its `==` marks, only the matching ones are marked.
    let text = '';
    let pos = 0;
    const marks: Span[] = [];

    for (const found of onLine) {
      text += lines[line].slice(pos, found.start);

      const start = text.length;

      text += found.text;

      if (matchesHighlight(found, criterion)) marks.push({ start, end: text.length });

      pos = found.end;
    }

    text += lines[line].slice(pos);

    return windowsAround(text, marks).map(window => ({
      line,
      text: window.text,
      marks: window.spans,
      cutStart: window.cutStart,
      cutEnd: window.cutEnd,
    }));
  });
}

function passagesIn(lines: string[], pattern: RegExp | null): Passage[] {
  if (!pattern) return [];

  return lines.flatMap((lineText, line) =>
    windowsAround(lineText, matchSpans(lineText, pattern)).map(window => ({
      line,
      text: window.text,
      highlights: window.spans.map((span): [number, number] => [span.start, span.end]),
      cutStart: window.cutStart,
      cutEnd: window.cutEnd,
    })));
}

interface Window {
  text: string;
  /** The spans inside the window, with offsets in its `text`. */
  spans: Span[];
  cutStart: boolean;
  cutEnd: boolean;
}

/**
 * The parts of a line around its spans, `OCCURRENCE_CONTEXT_WORDS` words on each side: one per
 * group of spans whose contexts touch.
 */
function windowsAround(lineText: string, spans: Span[]): Window[] {
  if (spans.length === 0) return [];

  const tokens = matchSpans(lineText, /\S+/g);
  const windows: Array<{ from: number; to: number; spans: Span[] }> = [];

  for (const span of spans) {
    const first = tokens.findIndex(t => t.end > span.start);
    let last = first;

    while (last + 1 < tokens.length && tokens[last + 1].start < span.end) last++;
    const from = Math.max(0, first - OCCURRENCE_CONTEXT_WORDS);
    const to = Math.min(tokens.length - 1, last + OCCURRENCE_CONTEXT_WORDS);
    const previous = windows[windows.length - 1];

    // Contexts touch when no word lies between them.
    if (previous && from <= previous.to + 1) {
      previous.to = Math.max(previous.to, to);
      previous.spans.push(span);
    } else {
      windows.push({ from, to, spans: [span] });
    }
  }

  return windows.map(({ from, to, spans: inWindow }) => {
    const offset = tokens[from].start;

    return {
      text: lineText.slice(offset, tokens[to].end),
      spans: inWindow.map(span => ({ start: span.start - offset, end: span.end - offset })),
      cutStart: from > 0,
      cutEnd: to < tokens.length - 1,
    };
  });
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
