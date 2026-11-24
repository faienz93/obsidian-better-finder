import { App, TFile } from "obsidian";
import { isExcalidraw } from "./excalidraw";

/** The Obsidian (Lucide) icon a result shows for its file type, and the text its tooltip shows. */
export interface FileTypeIcon {
  icon: string;
  label: string;
}

const ICONS: Record<string, string> = {
  canvas: 'layout-dashboard',
  pdf: 'book-open',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  docx: 'file-text',
  xlsx: 'table',
  json: 'braces',
  base: 'database',
};

/** The single answer to "which icon does this file show?". */
export function fileTypeIcon(app: App, file: TFile): FileTypeIcon | undefined {
  const ext = file.extension.toLowerCase();

  if (ext === 'md') {
    return isExcalidraw(app, file) ? { icon: 'pencil', label: 'excalidraw' } : undefined;
  }

  return { icon: ICONS[ext] ?? 'file', label: ext };
}
