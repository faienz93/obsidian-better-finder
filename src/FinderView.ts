import { ItemView, WorkspaceLeaf, TFile, MarkdownRenderer, Menu } from "obsidian";
import { FinderCore, SearchResult, isCommand } from "./FinderCore";
import { emojis, i18n } from "./const";

export const FINDER_VIEW_TYPE = "better-finder-view";



export class FinderView extends ItemView {
  private core: FinderCore;
  private inputEl: HTMLInputElement;
  // Card
  private resultsEl: HTMLElement;
  private resultCountEl: HTMLElement;
  private isGridView = true;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.core = new FinderCore(this.app);
    // this.resultCountEl.setText(`0 risultati`);
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

    // Input wrapper (contiene input + contatore)
    const inputWrapper = headerEl.createDiv({ cls: "finder-view-input-wrapper" });

    this.inputEl = inputWrapper.createEl("input", {
      type: "text",
      placeholder: "Search files...",
      cls: "finder-view-input"
    });

    this.resultCountEl = inputWrapper.createSpan({ cls: "finder-view-count" });

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
      btn.setText(emojis.listIcon); // List icon
      btn.setAttribute("title", "Switch to list view");
    } else {
      btn.setText(emojis.gridIcon); // Grid icon
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
    this.resultCountEl.setText(`${this.core.lastResultCount} ${i18n.results}`);

    results.forEach(result => {
      const el = this.resultsEl.createDiv({ cls: 'finder-view-result' });

      if (isCommand(result)) {
        this.core.renderCommand(result, el);
      } else {
        this.renderFile(result as TFile, el);
      }

      el.addEventListener('click', () => this.core.handleSelection(result));

      // Context menu (right-click) - same as file explorer
      if (!isCommand(result)) {
        el.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          const menu = new Menu();
          this.app.workspace.trigger('file-menu', menu, result as TFile, 'file-explorer-context-menu');
          menu.showAtMouseEvent(event);
        });
      }
    });
  }


  // 1. Render file card aggiornato
  private renderFile(file: TFile, el: HTMLElement): void {
    el.addClass('suggestion-item');

    // Titolo e Badge (rimangono come li avevi fatti tu)
    const titleEl = el.createDiv({ cls: 'suggestion-title' });
    titleEl.createSpan({ text: file.basename });

    if (file.extension !== 'md') {
      const extBadge = titleEl.createSpan({
        text: file.extension.toUpperCase(),
        cls: 'suggestion-flair'
      });
      extBadge.setCssStyles({
        marginLeft: '8px',
        fontSize: '10px',
        padding: '2px 6px',
        background: 'var(--background-modifier-success)',
        borderRadius: '3px'
      });
    }

    // Container per la preview (la "cornice" del contenuto)
    const previewEl = el.createDiv({ cls: 'finder-view-preview' });
    this.loadPreview(file, previewEl);

    // Metadata (sotto la preview)
    const metaRow = el.createDiv({ cls: 'suggestion-note' });
    metaRow.createSpan({ text: new Date(file.stat.mtime).toLocaleDateString() });
    metaRow.createSpan({ text: file.parent?.path || '/', attr: { style: "margin-left: 10px; opacity: 0.6;" } });
  }

  // 2. L'unico metodo di caricamento che ti serve
  private async loadPreview(file: TFile, containerEl: HTMLElement): Promise<void> {
    containerEl.empty();
    containerEl.addClass('finder-view-preview');
    const ext = file.extension.toLowerCase();

    try {
      if (ext === 'md') {
        const rawContent = await this.app.vault.cachedRead(file);
        const cleaned = rawContent.replace(/^---[\s\S]*?---\n?/, '').slice(0, 500);
        await MarkdownRenderer.render(this.app, cleaned, containerEl, file.path, this);
        return;
      }

      if (ext === 'json') {
        containerEl.addClass('code-thumbnail');
        const rawContent = await this.app.vault.cachedRead(file);
        const preview = rawContent.slice(0, 300);
        const codeEl = containerEl.createEl('pre', { cls: 'code-preview' });
        codeEl.createEl('code', { text: preview });
        codeEl.setCssStyles({
          fontSize: '9px',
          lineHeight: '1.2',
          overflow: 'hidden',
          margin: '0',
          padding: '8px',
          background: 'var(--background-secondary)',
          color: 'var(--text-muted)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        });
        return;
      }

      // Fallback: embed nativo per tutto il resto
      await MarkdownRenderer.render(this.app, `![[${file.path}]]`, containerEl, '', this);
    } catch (e) {
      console.error('Preview error:', e);
      containerEl.setText('Preview not available');
    }
  }

}
