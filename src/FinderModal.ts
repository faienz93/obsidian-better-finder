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

    const fileCache = this.app.metadataCache.getFileCache(file);
    if (fileCache) {
      const fileTags = getAllTags(fileCache) || [];

      if (fileTags.length > 0) {
        // Container per i tag
        const tagsContainer = el.createDiv();
        tagsContainer.style.marginTop = '8px';
        tagsContainer.style.display = 'flex';
        tagsContainer.style.gap = '4px';
        tagsContainer.style.flexWrap = 'wrap';

        // Estrai i tag cercati per evidenziarli
        const searchedTags = this.extractTags(this.inputEl.value);

        fileTags.forEach(tag => {
          const tagEl = tagsContainer.createSpan({ text: tag });
          tagEl.style.background = 'var(--tag-background, #484848)';
          tagEl.style.color = 'var(--tag-color, #a855f7)';
          tagEl.style.padding = '2px 6px';
          tagEl.style.borderRadius = '4px';
          tagEl.style.fontSize = '11px';
          tagEl.style.border = '1px solid transparent';

          // Evidenzia se il tag matcha la ricerca
          const isMatched = searchedTags.some(searchTag =>
            tag.toLowerCase().includes(searchTag.slice(1))
          );

          if (isMatched) {
            tagEl.style.background = 'var(--interactive-accent)';
            tagEl.style.color = 'var(--text-on-accent)';
            tagEl.style.fontWeight = '500';
          }
        });
      }
    }
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


