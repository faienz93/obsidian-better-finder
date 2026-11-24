import { App, TFile } from "obsidian";

/** An Excalidraw drawing is a `.md` file whose text is the encoded scene, not a note. */
export function isExcalidraw(app: App, file: TFile): boolean {
  return app.metadataCache.getFileCache(file)?.frontmatter?.['excalidraw-plugin'] === 'parsed';
}

/** A note is a markdown file, `.md` in any case, that is not an Excalidraw drawing. */
export function isNote(app: App, file: TFile): boolean {
  return file.extension.toLowerCase() === 'md' && !isExcalidraw(app, file);
}

// Blank lines may sit between the heading and the fence; the Excalidraw plugin writes one.
const DRAWING_BLOCK = /^## Drawing[ \t]*(?:\r?\n[ \t]*)*\r?\n```(?:json|compressed-json)[ \t]*$/m;

/**
 * Whether a drawing's scene data sits outside the `%%` comment that should hide it. Obsidian then
 * renders it as a code block and highlights every line, which freezes the app for seconds on a
 * large drawing.
 */
export function isDrawingDataExposed(content: string): boolean {
  const block = DRAWING_BLOCK.exec(content);

  if (!block) return false;

  // An odd number of %% before the block leaves a comment open around it.
  const markers = content.slice(0, block.index).split('%%').length - 1;

  return markers % 2 === 0;
}
