import { App, TFile } from "obsidian";
import { isExcalidraw } from "../excalidraw";
import { HighlightCriterion, QueryReader, QueryToken } from "./types";

/** One Highlight of a note: the line it sits on and the text between its `==` marks. */
export interface Highlight {
  line: number;
  text: string;
  /** Start offset in the line of the opening `==`. */
  start: number;
  /** End offset in the line of the closing `==`. */
  end: number;
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

        return { line, text: match[1], start, end: start + match[0].length };
      }));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whether a Highlight is one the criterion asks for: its word as a whole word, in any case. */
export function matchesHighlight(highlight: Highlight, criterion: HighlightCriterion): boolean {
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
  readonly keys = ['highlight'];
  readonly takesValue = true;
  readonly valueOptional = true;

  read(token: QueryToken, current: HighlightCriterion | undefined): HighlightCriterion {
    return {
      colours: current?.colours ?? [],
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
