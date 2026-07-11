import { App, getAllTags, TFile } from "obsidian";
import { SearchFilter } from "./types";

export class TagsFilter extends SearchFilter<string[]> {
  readonly label = '#';
  readonly desc = 'tag';

  static readonly ARCHIVE_TAG = '#archive';

  /**
   * I file archiviati (#archive) sono esclusi dai risultati di default;
   * tornano visibili solo se la query contiene esplicitamente #archive.
   */
  excludeArchived(files: TFile[], searchedTags: string[], app: App): TFile[] {
    const archiveRequested = searchedTags.some(
      t => t === TagsFilter.ARCHIVE_TAG || t.startsWith(TagsFilter.ARCHIVE_TAG + '/')
    );

    if (archiveRequested) return files;

    return files.filter(file => {
      if (file.extension !== 'md') return true;

      const cache = app.metadataCache.getFileCache(file);

      if (!cache) return true;

      const fileTags = (getAllTags(cache) || []).map(t => t.toLowerCase());

      return !fileTags.some(
        ft => ft === TagsFilter.ARCHIVE_TAG || ft.startsWith(TagsFilter.ARCHIVE_TAG + '/')
      );
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
      const cache = app.metadataCache.getFileCache(file);

      if (!cache) return false;
      const fileTags = getAllTags(cache) || [];

      return tags.every(tag =>
        fileTags.some(ft => ft === tag || ft.startsWith(tag + '/') || ft.startsWith(tag + '-'))
      );
    });
  }
}
