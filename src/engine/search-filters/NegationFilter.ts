import { App, TFile, getAllTags } from "obsidian";
import { i18n } from "src/const";
import { matchesTag } from "./TagsFilter";
import { QueryToken, SearchFilter } from "./types";

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

// What may follow the "-": a file type keyword, a literal extension or a tag.
const NEGATED = /^#?[\w/-]+$/;

/**
 * Strategy di esclusione: "-x" rimuove dai risultati.
 * Prima iterazione: tipi file (keyword o estensione letterale) e tag.
 */
export class NegationFilter extends SearchFilter<'negations'> {
  readonly label = '-';
  readonly desc = i18n.exclude;
  readonly field = 'negations';
  readonly prefix = '-';

  accepts(negated: string): boolean {
    return NEGATED.test(negated);
  }

  read(token: QueryToken, current: NegationResult | undefined): NegationResult {
    const negated = token.value.toLowerCase();
    const result = { extensions: [...current?.extensions ?? []], tags: [...current?.tags ?? []] };

    if (negated.startsWith('#')) {
      result.tags.push(negated);
    } else {
      // Keyword nota → estensioni mappate; altrimenti il token è
      // un'estensione letterale (es. "-docx")
      result.extensions.push(...(KEYWORD_EXTENSIONS[negated] ?? [negated]));
    }

    return result;
  }

  filter(files: TFile[], negations: NegationResult | undefined, app: App): TFile[] {
    if (!negations || (negations.extensions.length === 0 && negations.tags.length === 0)) return files;

    return files.filter(file => {
      if (negations.extensions.includes(file.extension.toLowerCase())) return false;

      if (negations.tags.length > 0 && file.extension === 'md') {
        const cache = app.metadataCache.getFileCache(file);
        const fileTags = (cache ? getAllTags(cache) || [] : []).map(t => t.toLowerCase());
        const excluded = negations.tags.some(tag => fileTags.some(ft => matchesTag(ft, tag)));

        if (excluded) return false;
      }

      return true;
    });
  }
}
