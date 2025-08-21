import { App, Modal, TFile } from "obsidian";

class FinderModal extends Modal {
  constructor(app: App) {
    super(app);
    this.modalEl.addClass("better-finder-modal");
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl("h2", { cls: 'example', text: "Ricerca Avanzata 🔍" },);

    const input = contentEl.createEl("input", {
      type: "text",
      cls: 'example',
      placeholder: "Cerca... usa # per i tag"
    });

    input.addEventListener("input", async (e) => {
      const query = (e.target as HTMLInputElement).value;
      this.runSearch(query);
    });
  }

  async runSearch(query: string) {
    const files = this.app.vault.getMarkdownFiles();

    // estrai i tag dal query
    const tags = query.match(/#\w+/g) ?? [];

    // filtra file che contengono i tag
    const results = [];
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fileTags = cache?.tags?.map(t => t.tag) ?? [];

      // controlla se contiene tutti i tag
      if (tags.every(t => fileTags.includes(t))) {
        results.push(file);
      }
    }

    this.showResults(results);
  }

  showResults(results: TFile[]) {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Risultati" });

    results.forEach(file => {
      const card = contentEl.createEl("div", { cls: "search-card" });
      card.createEl("h3", { text: file.basename });

      // anteprima nota (contenuto)
      this.app.workspace.trigger("hover-link", {
        linktext: this.app.metadataCache.fileToLinktext(file, "/"),
        source: "advanced-search",
        hoverParent: card
      });
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export default FinderModal;


