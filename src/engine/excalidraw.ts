import { App, TFile } from "obsidian";

/** An Excalidraw drawing is a `.md` file whose text is the encoded scene, not a note. */
export function isExcalidraw(app: App, file: TFile): boolean {
  return app.metadataCache.getFileCache(file)?.frontmatter?.['excalidraw-plugin'] === 'parsed';
}
