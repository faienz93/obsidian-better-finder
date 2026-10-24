import { App, TFile } from "obsidian";
import { getFileTags } from "../fileTags";
import { SearchFilter } from "./types";

/**
 * True if `fileTag`, in any case, is `tag` itself or one of its nested tags (#tag/child). `tag` is
 * lowercase, as `extract` returns it, so only the file side is folded on this hot path.
 */
export function matchesTag(fileTag: string, tag: string): boolean {
  const lowerFileTag = fileTag.toLowerCase();

  return lowerFileTag === tag || lowerFileTag.startsWith(`${tag}/`);
}

export class TagsFilter extends SearchFilter<string[]> {
  readonly label = '#';
  readonly desc = 'tag';
  // TODO set in settings
  static readonly ARCHIVE_TAG = '#archive';

  /**
   * I file archiviati (#archive) sono esclusi dai risultati di default;
   * tornano visibili solo se la query contiene esplicitamente #archive.
   */
  excludeArchived(files: TFile[], searchedTags: string[], app: App): TFile[] {
    const archiveRequested = searchedTags.some(t => matchesTag(t, TagsFilter.ARCHIVE_TAG));

    if (archiveRequested) return files;

    return files.filter(file => {
      if (file.extension !== 'md') return true;

      return !getFileTags(file, app).some(ft => matchesTag(ft, TagsFilter.ARCHIVE_TAG));
    });
  }

  extract(query: string) {
    const tagRegex = /#([a-zA-Z0-9][\w\-/]*)/g;
    const matches = query.match(tagRegex);

    return matches ? matches.map(tag => tag.toLowerCase()) : [];
  }

  removeFrom(query: string) {
    return query.replace(/#([a-zA-Z0-9][\w\-/]*)/g, '').trim();
  }

  filter(files: TFile[], tags: string[], app: App): TFile[] {
    if (tags.length === 0) return files;

    return files.filter(file => {
      const fileTags = getFileTags(file, app);

      // Match esatto o gerarchico (#tag/figlio). Il vecchio startsWith(tag + '-')
      // faceva matchare tag "cugini" (#prompt pigliava #prompt-engineering): bug B2.
      return tags.every(tag => fileTags.some(ft => matchesTag(ft, tag)));
    });
  }
}
