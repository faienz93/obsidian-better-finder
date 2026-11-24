import { App, TFile } from "obsidian";
import { i18n } from "src/const";
import { getFileTags } from "../fileTags";
import { matchesTag } from "./TagsFilter";
import { QueryToken, SearchFilter } from "./types";

export interface NegationResult {
  extensions: string[];
  tags: string[];
}

// Keyword → excluded extensions (kept in line with FileTypeFilter/ImageFilter)
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
 * Exclusion: "-x" removes matches from the results.
 * First iteration: file types (keyword or literal extension) and tags.
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
      // A known keyword maps to its extensions; anything else is a literal extension (e.g. "-docx").
      result.extensions.push(...(KEYWORD_EXTENSIONS[negated] ?? [negated]));
    }

    return result;
  }

  filter(files: TFile[], negations: NegationResult | undefined, app: App): TFile[] {
    if (!negations || (negations.extensions.length === 0 && negations.tags.length === 0)) return files;

    return files.filter(file => {
      if (negations.extensions.includes(file.extension.toLowerCase())) return false;

      if (negations.tags.length > 0 && file.extension === 'md') {
        const fileTags = getFileTags(file, app);
        const excluded = negations.tags.some(tag => fileTags.some(ft => matchesTag(ft, tag)));

        if (excluded) return false;
      }

      return true;
    });
  }
}
