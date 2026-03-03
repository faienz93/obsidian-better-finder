import { App, getAllTags, TFile } from "obsidian";
import { SearchFilter } from "./types";

export class TagsFilter extends SearchFilter<string[]> {
  readonly label = '#';
  readonly desc = 'tag';

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

      return tags.every(tag => fileTags.includes(tag));
    });
  }
}
