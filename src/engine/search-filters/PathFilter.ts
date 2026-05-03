import { App, TFile } from "obsidian";
import { i18n } from "src/const";
import { SearchFilter } from "./types";

export class PathFilter extends SearchFilter<string | undefined> {
  readonly label = 'path:';
  readonly desc = i18n.path;

  extract(query: string): string | undefined {
    const match = query.match(/\bpath:\s*(\S+)/i);

    return match ? match[1].toLowerCase() : undefined;
  }

  removeFrom(query: string): string {
    return query.replace(/\bpath:\s*\S+/i, '').trim();
  }

  filter(files: TFile[], extracted: string | undefined, _app: App): TFile[] {
    if (!extracted) return files;

    return files.filter(f => (f.parent?.path ?? '').toLowerCase().includes(extracted));
  }
}
