import { App, TFile } from "obsidian";
import { i18n } from "src/const";
import { isExcalidraw } from "../excalidraw";
import { Narrowing, QueryReader, QueryToken } from "./types";

export abstract class FileTypeFilter extends QueryReader<'fileTypes'> {
  abstract readonly label: string;
  abstract readonly desc: string;
  readonly field = 'fileTypes';
  protected abstract extensions: string[];

  read(_token: QueryToken, fileTypes: string[]): string[] {
    return [...new Set([...fileTypes, ...this.extensions])];
  }
}

/**
 * Narrows by every file type the query named, read by the file type Filters into one field: the
 * extensions are alternatives, while Excalidraw, a frontmatter flag, narrows on its own first.
 */
export class FileTypeGroup implements Narrowing<'fileTypes'> {
  readonly field = 'fileTypes';

  filter(files: TFile[], types: string[], app: App): TFile[] {
    const results = types.includes('excalidraw') ? files.filter(file => isExcalidraw(app, file)) : files;
    const extensions = types.filter(t => t !== 'excalidraw');

    if (extensions.length === 0) {
      return results;
    }

    return results.filter(f => extensions.some(ext => f.extension === ext.slice(1)));
  }
}

export class PdfFilter extends FileTypeFilter {
  readonly label = 'pdf';
  readonly desc = 'PDF';
  readonly keywords = ['pdf'];
  protected extensions = ['.pdf'];
}

export class ImageFilter extends FileTypeFilter {
  readonly label = 'image';
  readonly desc = i18n.images;
  readonly keywords = ['immagine', 'image', 'img', 'png', 'jpg', 'jpeg', 'gif', 'webp'];
  protected extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
}

export class CanvasFilter extends FileTypeFilter {
  readonly label = 'canvas';
  readonly desc = 'canvas';
  readonly keywords = ['canvas'];
  protected extensions = ['.canvas'];
}

export class JsonFilter extends FileTypeFilter {
  readonly label = 'json';
  readonly desc = 'json';
  readonly keywords = ['json'];
  protected extensions = ['.json'];
}

export class BaseFilter extends FileTypeFilter {
  readonly label = 'base';
  readonly desc = 'base';
  readonly keywords = ['base'];
  protected extensions = ['.base'];
}
