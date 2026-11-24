import { App, TFile } from "obsidian";
import { i18n } from "src/const";
import { QueryToken, SearchFilter } from "./types";

export class PathFilter extends SearchFilter<'pathFilter'> {
  readonly label = 'path:';
  readonly desc = i18n.path;
  readonly field = 'pathFilter';
  readonly keys = ['path'];
  readonly takesValue = true;

  read(token: QueryToken, current: string | undefined): string {
    return current ?? token.value.toLowerCase();
  }

  filter(files: TFile[], extracted: string | undefined, _app: App): TFile[] {
    if (!extracted) return files;

    return files.filter(f => (f.parent?.path ?? '').toLowerCase().includes(extracted));
  }
}
