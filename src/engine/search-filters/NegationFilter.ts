import { App, TFile, getAllTags } from "obsidian";
import { i18n } from "src/const";
import { SearchFilter } from "./types";

export interface NegationResult {
  extensions: string[];
  tags: string[];
}

// Keyword → estensioni escluse (allineate a FileTypeFilter/ImageFilter)
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

const KEYWORD_EXTENSIONS: Record<string, string[]> = {
  pdf: ['pdf'],
  image: IMAGE_EXTENSIONS,
  img: IMAGE_EXTENSIONS,
  immagine: IMAGE_EXTENSIONS,
  canvas: ['canvas'],
  json: ['json'],
  base: ['base'],
};

// Token preceduto da "-" a inizio parola: "-image", "-#tag", "-docx".
// Il "-" deve essere preceduto da inizio stringa o spazio, così parole
// composte come "this-week" o "e-mail" non vengono toccate.
const NEGATION_PATTERN = /(?:^|\s)-(#?[\w/-]+)/g;

/**
 * Strategy di esclusione: "-x" rimuove dai risultati.
 * Prima iterazione: tipi file (keyword o estensione letterale) e tag.
 */
export class NegationFilter extends SearchFilter<NegationResult> {
  readonly label = '-';
  readonly desc = i18n.exclude;

  extract(query: string): NegationResult {
    const result: NegationResult = { extensions: [], tags: [] };

    for (const match of query.matchAll(NEGATION_PATTERN)) {
      const token = match[1].toLowerCase();

      if (token.startsWith('#')) {
        result.tags.push(token);
      } else {
        // Keyword nota → estensioni mappate; altrimenti il token è
        // un'estensione letterale (es. "-docx")
        result.extensions.push(...(KEYWORD_EXTENSIONS[token] ?? [token]));
      }
    }

    return result;
  }

  removeFrom(query: string): string {
    return query.replace(NEGATION_PATTERN, ' ').trim();
  }

  filter(files: TFile[], negations: NegationResult, app: App): TFile[] {
    if (negations.extensions.length === 0 && negations.tags.length === 0) return files;

    return files.filter(file => {
      if (negations.extensions.includes(file.extension.toLowerCase())) return false;

      if (negations.tags.length > 0 && file.extension === 'md') {
        const cache = app.metadataCache.getFileCache(file);
        const fileTags = (cache ? getAllTags(cache) || [] : []).map(t => t.toLowerCase());
        const excluded = negations.tags.some(tag =>
          fileTags.some(ft => ft === tag || ft.startsWith(`${tag  }/`))
        );

        if (excluded) return false;
      }

      return true;
    });
  }
}
