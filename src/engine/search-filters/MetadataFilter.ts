import { App, TFile } from "obsidian";
import { i18n } from "src/const";
import { SearchFilter } from "./types";

export interface MetadataPair {
  key: string;
  value: string;
}

// key:value generico. Il "-" nel key supporta chiavi tipo "reading-status".
// Le chiavi riservate (created:, title:, task:, ...) sono già state consumate
// dalle rispettive strategy prima che questa venga eseguita (vedi parse()).
const METADATA_PATTERN = /(?:^|\s)([a-zA-Z][\w-]*):(\S+)/g;

/**
 * Strategy sui metadati frontmatter: author:rossi, status:draft, ecc.
 * Match case-insensitive per substring; supporta valori array (es. lista autori).
 */
export class MetadataFilter extends SearchFilter<MetadataPair[]> {
  readonly label = 'author:';
  readonly desc = i18n.metadata;

  extract(query: string): MetadataPair[] {
    const pairs: MetadataPair[] = [];

    for (const match of query.matchAll(METADATA_PATTERN)) {
      // Ignora URL e simili ("https://..." darebbe key=https value=//...)
      if (match[2].startsWith('/')) continue;

      pairs.push({ key: match[1].toLowerCase(), value: match[2].toLowerCase() });
    }

    return pairs;
  }

  removeFrom(query: string): string {
    return query.replace(METADATA_PATTERN, (full, _key, value) =>
      value.startsWith('/') ? full : ' '
    ).trim();
  }

  filter(files: TFile[], pairs: MetadataPair[], app: App): TFile[] {
    if (pairs.length === 0) return files;

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
