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
    const ext = file.extension.toLowerCase();

    try {
      if (ext === 'md') {
        const rawContent = await this.app.vault.cachedRead(file);
        // Pulizia frontmatter e limite caratteri per non pesare sulla UI
        const content = rawContent.replace(/^---[\s\S]*?---\n?/, '').slice(0, 250);
        await MarkdownRenderer.render(this.app, content, containerEl, file.path, this);
      }
      else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
        const url = this.app.vault.getResourcePath(file);
        containerEl.createEl('img', {
          attr: { src: url, style: "width: 100%; height: 100%; object-fit: cover;" }
        });
      }
      else if (ext === 'pdf') {
        // Usa PDF.js (già incluso in Obsidian) per renderizzare la prima pagina
        containerEl.addClass('pdf-thumbnail');
        const pdfjs = (window as any).pdfjsLib;
        if (pdfjs) {
          const url = this.app.vault.getResourcePath(file);
          const pdf = await pdfjs.getDocument(url).promise;
          const page = await pdf.getPage(1);

          const canvas = containerEl.createEl('canvas');
          const context = canvas.getContext('2d');

          // Scala per adattarsi al container
          const containerWidth = containerEl.clientWidth || 260;
          const viewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / viewport.width;
          const scaledViewport = page.getViewport({ scale });

          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';

          await page.render({
            canvasContext: context,
            viewport: scaledViewport
          }).promise;
        }
      }
    } catch (e) {
      containerEl.setText('Preview error');
    }
  }

}
