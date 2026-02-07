import { ItemView, WorkspaceLeaf, TFile, MarkdownRenderer } from "obsidian";
import { FinderCore, SearchResult, isCommand } from "./FinderCore";

export const FINDER_VIEW_TYPE = "better-finder-view";



export class FinderView extends ItemView {
  private core: FinderCore;
  private inputEl: HTMLInputElement;
  private resultsEl: HTMLElement;
  private isGridView = true;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.core = new FinderCore(this.app);
  }

  getViewType(): string {
    return FINDER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Better Finder";
  }

  getIcon(): string {
    return "search";
  }

  async onOpen(): Promise<void> {
    this.buildUI();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  private buildUI(): void {
    const container = this.contentEl.createDiv({ cls: "finder-view-container" });

    // Header con input e toggle
    const headerEl = container.createDiv({ cls: "finder-view-header" });

    // Input di ricerca
    this.inputEl = headerEl.createEl("input", {
      type: "text",
      placeholder: "Search files...",
      cls: "finder-view-input"
    });

    // Toggle view button
    const toggleBtn = headerEl.createEl("button", { cls: "finder-view-toggle" });
    toggleBtn.setAttribute("aria-label", "Toggle view");
    this.updateToggleIcon(toggleBtn);
    toggleBtn.addEventListener("click", () => {
      this.isGridView = !this.isGridView;
      this.updateToggleIcon(toggleBtn);
      this.resultsEl.toggleClass("grid-view", this.isGridView);
      this.resultsEl.toggleClass("list-view", !this.isGridView);
    });

    // Hint bar
    this.core.renderHints(container, (hint) => {
      this.inputEl.value = hint + ' ';
      this.inputEl.focus();
      this.onSearch();
    });

    // Container risultati
    this.resultsEl = container.createDiv({ cls: "finder-view-results grid-view" });

    // Event listener per input con debounce
    let debounceTimer: number;
    this.inputEl.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => this.onSearch(), 150);
    });

    this.inputEl.focus();
  }

  private updateToggleIcon(btn: HTMLElement): void {
    btn.empty();
    if (this.isGridView) {
      btn.setText("☰"); // List icon
      btn.setAttribute("title", "Switch to list view");
    } else {
      btn.setText("⊞"); // Grid icon
      btn.setAttribute("title", "Switch to grid view");
    }
  }



  private async onSearch(): Promise<void> {
    this.core.updateHintHighlights(this.inputEl.value);
    const results = await this.core.search(this.inputEl.value);
    this.renderResults(results);
  }



  private renderResults(results: SearchResult[]): void {
    this.resultsEl.empty();

    results.forEach(result => {
      const el = this.resultsEl.createDiv({ cls: 'finder-view-result' });

      if (isCommand(result)) {
        this.core.renderCommand(result, el);
      } else {
        this.renderFile(result as TFile, el);
      }

      el.addEventListener('click', () => this.core.handleSelection(result));
    });
  }


  // Render file card
  private renderFile(file: TFile, el: HTMLElement): void {
    el.addClass('suggestion-item');

    // Title
    const titleEl = el.createDiv({ cls: 'suggestion-title' });
    titleEl.createSpan({ text: file.basename });

    if (file.extension !== 'md') {
      const extBadge = titleEl.createSpan({
        text: file.extension.toUpperCase(),
        cls: 'suggestion-flair'
      });
      extBadge.style.marginLeft = '8px';
      extBadge.style.fontSize = '10px';
      extBadge.style.padding = '2px 6px';
      extBadge.style.background = 'var(--background-modifier-success)';
      extBadge.style.borderRadius = '3px';
    }

    // Metadata (visible only in list view)
    const metaRow = el.createDiv({ cls: 'suggestion-note' });
    const dateEl = metaRow.createSpan();
    dateEl.setText(new Date(file.stat.mtime).toLocaleDateString());
    const pathEl = metaRow.createSpan();
    pathEl.setText(file.parent?.path || '/');

    // Content preview
    const previewEl = el.createDiv({ cls: 'finder-view-preview markdown-preview-view' });
    this.loadPreview(file, previewEl);
  }

  private async loadPreview(file: TFile, containerEl: HTMLElement): Promise<void> {
    try {
      const ext = file.extension.toLowerCase();

      if (ext === 'md') {
        // Markdown: mostra contenuto testuale
        const rawContent = await this.app.vault.cachedRead(file);
        const contentWithoutFrontmatter = rawContent.replace(/^---[\s\S]*?---\n?/, '');
        const content = contentWithoutFrontmatter.slice(0, 300);
        await MarkdownRenderer.render(this.app, content, containerEl, file.path, this);
      } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
        // Immagini: embed nativo
        await MarkdownRenderer.render(this.app, `![[${file.path}]]`, containerEl, file.path, this);
      } else if (ext === 'pdf') {
        // PDF: embed nativo come per le immagini
        await MarkdownRenderer.render(this.app, `![[${file.path}]]`, containerEl, file.path, this);
      }
    } catch (e) {
      containerEl.setText('Unable to load preview');
    }
  }

}
