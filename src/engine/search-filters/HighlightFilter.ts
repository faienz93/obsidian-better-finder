import { App, TFile } from "obsidian";
import { SearchFilterAsync } from "./types";

export class HighlightFilter extends SearchFilterAsync<string | undefined> {
  readonly label = 'highlight:';
  readonly desc = 'highlight';

  extract(query: string): string | undefined {
    // Supporta highlight:"frase con spazi" e highlight:parola
    const match = /\bhighlight:(?:"([^"]+)"|(\S+))/.exec(query);

    if (!match) return undefined;

    return match[1] ?? match[2];
  }

  removeFrom(query: string): string {
    return query.replace(/\bhighlight:(?:"[^"]*"|\S*)/gi, '').trim();
  }

  async filterAsync(files: TFile[], term: string | undefined, app: App): Promise<TFile[]> {
    if (!term) return files;

    const lowerTerm = term.toLowerCase();
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
              if (match[1].toLowerCase().includes(lowerTerm)) {
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
