import { App, SuggestModal, TFile, getAllTags } from "obsidian";


class FinderModal extends SuggestModal<TFile> {

  allMdFiles: TFile[];

  constructor(app: App) {
    super(app);
    // https://docs.obsidian.md/Plugins/User+interface/HTML+elements
    // this.modalEl.addClass("better-finder-modal");
    this.allMdFiles = app.vault.getMarkdownFiles();
  }

  onOpen(): void {
    // this.selectAllTags(this.app)
  }


  // Returns all available suggestions.
  getSuggestions(query: string): TFile[] {
    const regexp = /(?:^|\s)(#[a-z0-9][\w-]*)/gi;


    const match = query.match(regexp) ?? [];
    const searchedTag = match.map(x => x.trim()) || null;

    if (!searchedTag) return [];

    const res = this.allMdFiles.filter((file) => {
      const fileCache = this.app.metadataCache.getFileCache(file);
      if (fileCache) {
        const fileTags = getAllTags(fileCache) || [];
        return searchedTag.every(tag => fileTags.includes(tag));
      }
    })
    return res
  }

  // Renders each suggestion item.
  renderSuggestion(file: TFile, el: HTMLElement) {
    el.createEl('div', { text: file.name });
    // el.createEl('small', { text: file.basename });
    el.createEl('small', { text: file.extension });
    el.createEl('small', { text: file.stat.ctime.toString() });
  }

  // Perform action on the selected suggestion.
  onChooseSuggestion(book: TFile) {
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


