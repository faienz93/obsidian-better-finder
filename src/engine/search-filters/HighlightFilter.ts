import { App, TFile } from "obsidian";
import { isExcalidraw } from "../excalidraw";
import { HighlightColour, HighlightCriterion, QueryReader, QueryToken } from "./types";

/** One Highlight of a note: the line it sits on and the text between its `==` marks. */
export interface Highlight {
  line: number;
  /** The text between the `==` marks, without the colour emoji. */
  text: string;
  /** Set by the emoji right after the opening `==`; none means the theme's default colour. */
  colour?: HighlightColour;
  /** Start offset in the line of the opening `==`. */
  start: number;
  /** End offset in the line of the closing `==`. */
  end: number;
}

// Obsidian writes the circle and reads the square as well.
const COLOUR_BY_EMOJI: Record<string, HighlightColour> = {
  '🔴': 'red', '🟠': 'orange', '🟡': 'yellow', '🟢': 'green', '🔵': 'blue', '🟣': 'purple',
  '🟥': 'red', '🟧': 'orange', '🟨': 'yellow', '🟩': 'green', '🟦': 'blue', '🟪': 'purple',
};

const COLOURS: HighlightColour[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

// `highlight:` asks for any colour; each `highlight-<colour>:` adds its colour.
const COLOUR_BY_KEY: Record<string, HighlightColour | undefined> = {
  highlight: undefined,
  ...Object.fromEntries(COLOURS.map(colour => [`highlight-${colour}`, colour])),
};

/** The colour a Highlight's text opens with, and the text without its emoji. */
function colourOf(text: string): { colour?: HighlightColour; text: string } {
  const emoji = [...text][0];
  const colour = COLOUR_BY_EMOJI[emoji];

  return colour ? { colour, text: text.slice(emoji.length) } : { text };
}

// Opens and closes on the same line, as Obsidian draws it: a stray `==` never spans paragraphs.
const HIGHLIGHT = /==([^\n]+?)==/g;

/** Every Highlight in a note's content, in reading order. `== ==` marks nothing, so it is none. */
export function highlightsIn(content: string): Highlight[] {
  return content.split('\n').flatMap((lineText, line) =>
    [...lineText.matchAll(HIGHLIGHT)]
      .filter(match => match[1].trim().length > 0)
      .map(match => {
        const start = match.index ?? 0;

        return { line, ...colourOf(match[1]), start, end: start + match[0].length };
      }));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whether a Highlight is one the criterion asks for: one of its colours, when it names any, and its
 * word as a whole word, in any case.
 */
export function matchesHighlight(highlight: Highlight, criterion: HighlightCriterion): boolean {
  const colours = criterion.colours;

  if (colours.length > 0 && !(highlight.colour && colours.includes(highlight.colour))) return false;
  if (!criterion.word) return true;

  // Word-boundary match: a plain substring match caught too many highlights (bug B5).
  return new RegExp(`\\b${escapeRegExp(criterion.word)}\\b`, 'i').test(highlight.text);
}

/**
 * `highlight:` alone keeps the notes with a Highlight; with a word, those with the word inside
 * one. Reads file content, so it narrows asynchronously, before the free text search.
 */
export class HighlightFilter extends QueryReader<'highlightFilter'> {
  readonly label = 'highlight:';
  readonly desc = 'highlight';
  readonly field = 'highlightFilter';
  readonly keys = Object.keys(COLOUR_BY_KEY);
  readonly takesValue = true;
  readonly valueOptional = true;

  read(token: QueryToken, current: HighlightCriterion | undefined): HighlightCriterion {
    const colours = current?.colours ?? [];
    const colour = COLOUR_BY_KEY[token.key];

    return {
      colours: colour && !colours.includes(colour) ? [...colours, colour] : colours,
      word: current?.word ?? (token.value || undefined),
    };
  }

  async filterAsync(files: TFile[], criterion: HighlightCriterion | undefined, app: App): Promise<TFile[]> {
    if (!criterion) return files;

    const notes = files.filter(file => file.extension === 'md' && !isExcalidraw(app, file));
    const kept = await Promise.all(notes.map(async (file) => {
      try {
        const content = await app.vault.cachedRead(file);

        return highlightsIn(content).some(highlight => matchesHighlight(highlight, criterion));
      } catch {
        // Unreadable file: skip it.
        return false;
      }
    }));

    return notes.filter((_, i) => kept[i]);
  }
}
