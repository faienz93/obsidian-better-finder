import { App, TFile } from "obsidian";
import { i18n } from "src/const";
import { SearchFilter } from "./types";

export abstract class FileTypeFilter extends SearchFilter<string[]> {
  abstract readonly label: string;
  abstract readonly desc: string;
  protected abstract pattern: RegExp;
  protected abstract extensions: string[];

  extract(query: string): string[] {
    return this.pattern.test(query.toLowerCase()) ? this.extensions : [];
  }

  removeFrom(query: string): string {
    return query.replace(this.pattern, '').trim();
  }

  filter(files: TFile[], types: string[], _app: App): TFile[] {
    if (types.length === 0 || types.includes('*')) {
      return files;
    }

    return files.filter(f => types.some(ext => f.extension === ext.slice(1)));
  }
}

export class PdfFilter extends FileTypeFilter {
  readonly label = 'pdf';
  readonly desc = 'PDF';
  protected pattern = /\bpdf\b/gi;
  protected extensions = ['.pdf'];
}

export class ImageFilter extends FileTypeFilter {
  readonly label = 'image';
  readonly desc = i18n.images;
  protected pattern = /\b(immagine|image|img|png|jpg|jpeg|gif|webp)\b/gi;
  protected extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
}

export class CanvasFilter extends FileTypeFilter {
  readonly label = 'canvas';
  readonly desc = 'canvas';
  protected pattern = /\bcanvas\b/gi;
  protected extensions = ['.canvas'];
}

export class JsonFilter extends FileTypeFilter {
  readonly label = 'json';
  readonly desc = 'json';
  protected pattern = /\bjson\b/gi;
  protected extensions = ['.json'];
}

export class BaseFilter extends FileTypeFilter {
  readonly label = 'base';
  readonly desc = 'base';
  protected pattern = /\bbase\b/gi;
  protected extensions = ['.base'];
}
