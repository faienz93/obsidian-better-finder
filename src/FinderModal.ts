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

  private extractTags(query: string): string[] {
    // Supporta: #tag, #tag-with-dashes, #tag_with_underscores, #tag/nested
    // /#([a-zA-Z0-9][\w\-\/]*)/g; OLD
    const tagRegex = /#([a-zA-Z0-9][\w\-\/]*)/g;
    const matches = query.match(tagRegex);
    return matches ? matches.map(tag => tag.toLowerCase()) : [];
  }


  // Returns all available suggestions.
  getSuggestions(query: string): TFile[] {
    const searchedTag = this.extractTags(query)

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
    el.createEl('small', { text: new Date(file.stat.ctime).toLocaleDateString() });
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


