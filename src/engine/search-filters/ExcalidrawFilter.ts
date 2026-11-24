import { App, TFile } from "obsidian";
import { QueryReader, QueryToken } from "./types";

/** Excalidraw drawings are markdown files the Excalidraw plugin flags in their frontmatter. */
export function isExcalidraw(file: TFile, app: App): boolean {
  return app.metadataCache.getFileCache(file)?.frontmatter?.['excalidraw-plugin'] === 'parsed';
}

export class ExcalidrawFilter extends QueryReader<'fileTypes'> {
  readonly label = 'excalidraw';
  readonly desc = 'Excalidraw';
  readonly field = 'fileTypes';
  readonly keywords = ['excalidraw'];

  read(_token: QueryToken, fileTypes: string[]): string[] {
    return [...new Set([...fileTypes, 'excalidraw'])];
  }
}
