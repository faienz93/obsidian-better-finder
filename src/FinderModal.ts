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
    this.selectAllTags(this.app)
  }


  // Returns all available suggestions.
  getSuggestions(query: string): TFile[] {


    const allMdFiles = this.app.vault.getMarkdownFiles();
    const cache = this.app.metadataCache;

    const test = this.app.metadataCache.getFileCache(allMdFiles[869])

    const result = getAllTags(test)
    console.log(result)
    console.log("-------------------")
    // return ALL_BOOKS.filter((book) =>
    //   // book.title.toLowerCase().includes(query.toLowerCase())
    // book
    // );

    console.log(allMdFiles)
    return allMdFiles
  }

  // Renders each suggestion item.
  renderSuggestion(book: TFile, el: HTMLElement) {
    el.createEl('div', { text: book.name });
    el.createEl('small', { text: book.name });
  }

  // Perform action on the selected suggestion.
  onChooseSuggestion(book: TFile, evt: MouseEvent | KeyboardEvent) {
    new Notice(`Selected ${book}`);
  }


  selectAllTags(app: App) {
    const allTags: string[] = [];
    const allFiles = app.vault.getMarkdownFiles();
    const cache = this.app.metadataCache;

    allFiles.forEach(file => {
      const fileCache = cache.getFileCache(file);
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


