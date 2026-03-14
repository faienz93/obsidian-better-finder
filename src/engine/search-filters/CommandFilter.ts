import { App, TFile } from "obsidian";
import { i18n } from "src/const";
import { SearchFilter } from "./types";

export class CommandFilter extends SearchFilter<{ isCommandMode: boolean; commandText?: string }> {
  readonly label = '>';
  readonly desc = i18n.commands;

  filter(_files: TFile[], _extracted: { isCommandMode: boolean; commandText?: string; }, _app: App): TFile[] {
    throw new Error("Method not implemented.");
  }

  extract(query: string): { isCommandMode: boolean; commandText?: string } {
    const trimmed = query.trim();

    if (trimmed.startsWith('>')) {
      return { isCommandMode: true, commandText: trimmed.slice(1).trim() };
    }

    return { isCommandMode: false };
  }

  removeFrom(query: string): string {
    return query.replace(/^>\s*/, '').trim();
  }
}
