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

    const regexp = /#(\S+)/;
    const match = query.match(regexp);
    if (!match) return [];

    console.log(match)

    const searchedTag = match[1];
    // console.log("XXXXXXX")
    // console.log(searchedTag)


    const allMdFiles = this.app.vault.getMarkdownFiles();

    const res = allMdFiles.filter((file) => {
      const fileCache = this.app.metadataCache.getFileCache(file);
      if (fileCache) {
        const fileTags = getAllTags(fileCache) || [];
        return fileTags.includes(`#${searchedTag}`);
      }

    })


    console.log(res)
    return res






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


