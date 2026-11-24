import { App, TFile } from "obsidian";
import { i18n } from "src/const";
import { QueryToken, SearchFilter } from "./types";

export interface MetadataPair {
  key: string;
  value: string;
}

/**
 * Strategy sui metadati frontmatter: author:rossi, status:draft, ecc.
 * Match case-insensitive per substring; supporta valori array (es. lista autori).
 */
export class MetadataFilter extends SearchFilter<'metadataFilters'> {
  readonly label = 'author:';
  readonly desc = i18n.metadata;
  readonly field = 'metadataFilters';

  /** An empty value is free text, and so is a URL: "https://x" would read as key https. */
  accepts(value: string): boolean {
    return value !== '' && !value.startsWith('/');
  }

  read(token: QueryToken, pairs: MetadataPair[] | undefined): MetadataPair[] {
    return [...pairs ?? [], { key: token.key, value: token.value.toLowerCase() }];
  }

  filter(files: TFile[], pairs: MetadataPair[] | undefined, app: App): TFile[] {
    if (!pairs || pairs.length === 0) return files;

    return files.filter(file => {
      if (file.extension !== 'md') return false;

      const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;

      if (!frontmatter) return false;

      return pairs.every(pair => this.matches(frontmatter, pair));
    });
  }

  private matches(frontmatter: Record<string, unknown>, pair: MetadataPair): boolean {
    // Lookup case-insensitive della chiave
    const key = Object.keys(frontmatter).find(k => k.toLowerCase() === pair.key);

    if (!key) return false;

    const value = frontmatter[key];

    if (Array.isArray(value)) {
      return value.some(v => String(v).toLowerCase().includes(pair.value));
    }

    return String(value).toLowerCase().includes(pair.value);
  }
}
