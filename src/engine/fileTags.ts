import { App, getAllTags, TFile } from "obsidian";
import { CanvasTagCache } from "./CanvasTagCache";

/**
 * A file's tags as they were written: notes from the metadata cache, canvases from the canvas tag
 * common cache. Compare them with `matchesTag`, which ignores case.
 */
export function getFileTags(file: TFile, app: App): string[] {
  if (file.extension === 'canvas') {
    return CanvasTagCache.getInstance(app).getTags(file);
  }

  const cache = app.metadataCache.getFileCache(file);

  return cache ? getAllTags(cache) || [] : [];
}
