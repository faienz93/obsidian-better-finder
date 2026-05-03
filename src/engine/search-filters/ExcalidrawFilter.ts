import { App, TFile } from "obsidian";
import { SearchFilter } from "./types";

export class ExcalidrawFilter extends SearchFilter<string[]> {
  readonly label = 'excalidraw';
  readonly desc = 'Excalidraw';

  private readonly pattern = /\bexcalidraw\b/gi;

  extract(query: string): string[] {
    return this.pattern.test(query) ? ['excalidraw'] : [];
  }

  removeFrom(query: string): string {
    return query.replace(this.pattern, '').replace(/\s+/g, ' ').trim();
  }

  filter(files: TFile[], extracted: string[], app: App): TFile[] {
    if (extracted.length === 0) {
      return files;
    }

    return files.filter(file => {
      const cache = app.metadataCache.getFileCache(file);

      return cache?.frontmatter?.['excalidraw-plugin'] === 'parsed';
    });
  }
}
