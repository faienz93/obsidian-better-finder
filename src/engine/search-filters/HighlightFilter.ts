import { App, TFile } from "obsidian";
import { QueryReader, QueryToken } from "./types";

/** Reads file content, so it narrows asynchronously, in place of the free text search. */
export class HighlightFilter extends QueryReader<'highlightFilter'> {
  readonly label = 'highlight:';
  readonly desc = 'highlight';
  readonly field = 'highlightFilter';
  readonly keys = ['highlight'];
  readonly takesValue = true;

  read(token: QueryToken, current: string | undefined): string {
    return current ?? token.value;
  }

  async filterAsync(files: TFile[], term: string | undefined, app: App): Promise<TFile[]> {
    if (!term) return files;

    // Match a confine di parola: il vecchio includes() (substring) faceva
    // matchare troppe evidenziazioni (bug B5)
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordPattern = new RegExp(`\\b${escaped}\\b`, 'i');
    const pattern = /==([^=]+)==/g;
    const results: TFile[] = [];

    await Promise.all(
      files
        .filter(f => f.extension === 'md')
        .map(async (file) => {
          try {
            const content = await app.vault.cachedRead(file);
            let match: RegExpExecArray | null;

            pattern.lastIndex = 0;

            while ((match = pattern.exec(content)) !== null) {
              if (wordPattern.test(match[1])) {
                results.push(file);
                break;
              }
            }
          } catch {
            // file non leggibile, skip
          }
        })
    );

    return results;
  }
}
