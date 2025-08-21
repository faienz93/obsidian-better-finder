import { App, CachedMetadata, Notice, Pos, SuggestModal, TFile, TagCache, getAllTags } from "obsidian";

interface Book {
  title: string;
  author: string;
}


class FinderModal extends SuggestModal<TFile> {


  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    // this.selectAllTags(this.app)
  }


  // Returns all available suggestions.
  getSuggestions(query: string): TFile[] {
    const regexp = /(?:^|\s)(#[a-z0-9]\w*)/gi;

    const match = query.match(regexp) ?? [];
    const searchedTag = match.map(x => x.trim()) || null;

    if (!searchedTag) return [];


    const allMdFiles = this.app.vault.getMarkdownFiles();

    const res = allMdFiles.filter((file) => {
      const fileCache = this.app.metadataCache.getFileCache(file);
      if (fileCache) {
        const fileTags = getAllTags(fileCache) || [];
        return searchedTag.every(tag => fileTags.includes(tag));
      }

    })

    return res






  }

  // Renders each suggestion item.
  renderSuggestion(book: TFile, el: HTMLElement) {
    el.createEl('div', { text: book.name });
    el.createEl('small', { text: book.name });
  }

  // Perform action on the selected suggestion.
  onChooseSuggestion(book: TFile, evt: MouseEvent | KeyboardEvent) {
    // new Notice(`Selected ${book}`);
    const leaf = this.app.workspace.getLeaf(false); // false = open in the current tab
    leaf.openFile(book);
  }


  selectAllTags(app: App) {
    const allTags: string[] = [];
    const allFiles = app.vault.getMarkdownFiles();


    allFiles.forEach(file => {
      const fileCache = this.app.metadataCache.getFileCache(file);
      if (fileCache != null) {
        const fileTags = getAllTags(fileCache);
        if (fileTags) {
          allTags.push(...fileTags);
        }
      }
    });

    console.log(allTags)
  }
}

export default FinderModal;


