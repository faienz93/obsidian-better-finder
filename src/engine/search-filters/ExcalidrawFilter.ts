import { QueryReader, QueryToken } from "./types";

/** Excalidraw drawings are markdown files the Excalidraw plugin flags in their frontmatter. */
export class ExcalidrawFilter extends QueryReader<'fileTypes'> {
  readonly label = 'excalidraw';
  readonly desc = 'Excalidraw';
  readonly field = 'fileTypes';
  readonly keywords = ['excalidraw'];

  read(_token: QueryToken, fileTypes: string[]): string[] {
    return [...new Set([...fileTypes, 'excalidraw'])];
  }
}
