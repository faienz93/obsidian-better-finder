import { ItemView, WorkspaceLeaf, TFile, MarkdownRenderer, Menu } from "obsidian";
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
      else if (ext === 'canvas') {
        // Canvas di Obsidian - mostra miniatura dei nodi
        containerEl.addClass('canvas-thumbnail');
        const rawContent = await this.app.vault.cachedRead(file);
        const canvasData = JSON.parse(rawContent);

        // Crea una miniatura SVG del canvas
        const svg = containerEl.createSvg('svg', {
          attr: { viewBox: '0 0 100 100', style: 'width: 100%; height: 100%;' }
        });

        // Background
        svg.createSvg('rect', {
          attr: { x: '0', y: '0', width: '100', height: '100', fill: 'var(--background-secondary)' }
        });

        if (canvasData.nodes && canvasData.nodes.length > 0) {
          // Calcola bounds per normalizzare le posizioni
          const nodes = canvasData.nodes;
          const minX = Math.min(...nodes.map((n: any) => n.x));
          const maxX = Math.max(...nodes.map((n: any) => n.x + (n.width || 100)));
          const minY = Math.min(...nodes.map((n: any) => n.y));
          const maxY = Math.max(...nodes.map((n: any) => n.y + (n.height || 100)));
          const rangeX = maxX - minX || 1;
          const rangeY = maxY - minY || 1;

          // Disegna i nodi come rettangoli
          nodes.slice(0, 20).forEach((node: any) => {
            const x = ((node.x - minX) / rangeX) * 90 + 5;
            const y = ((node.y - minY) / rangeY) * 90 + 5;
            const w = Math.max(((node.width || 100) / rangeX) * 90, 3);
            const h = Math.max(((node.height || 100) / rangeY) * 90, 3);

            svg.createSvg('rect', {
              attr: {
                x: String(x), y: String(y), width: String(w), height: String(h),
                fill: node.color ? `var(--color-${node.color})` : 'var(--interactive-accent)',
                opacity: '0.7', rx: '2'
              }
            });
          });
        }
      }
      else if (ext === 'base') {
        containerEl.addClass('base-thumbnail');
        const rawContent = await this.app.vault.cachedRead(file);
        const baseData = JSON.parse(rawContent);

        // Invece di un solo SVG, creiamo un mini-container HTML per avere più controllo
        const previewWrapper = containerEl.createDiv({ cls: 'base-preview-wrapper' });

        // Titolo o intestazione del database
        const header = previewWrapper.createDiv({ cls: 'base-preview-header' });
        header.setText(file.basename);

        // Creiamo una tabella HTML ultra-leggera (più facile da gestire dell'SVG per i testi)
        const table = previewWrapper.createEl('table', { cls: 'base-preview-table' });

        // Estrai colonne e righe reali
        const columns = baseData.columns || Object.keys(baseData.schema || {}).slice(0, 3);
        const rows = baseData.rows || baseData.data || [];

        // Renderizza intestazioni (max 3)
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        columns.slice(0, 3).forEach(col => {
          const th = headerRow.insertCell();
          th.setText(typeof col === 'string' ? col : (col.name || 'Property'));
        });

        // Renderizza dati reali (max 5 righe)
        const tbody = table.createTBody();
        rows.slice(0, 5).forEach(rowData => {
          const tr = tbody.insertRow();
          columns.slice(0, 3).forEach(col => {
            const td = tr.insertCell();
            const colId = col.id || col;
            const value = rowData[colId] || '';
            td.setText(String(value).substring(0, 20)); // Tronca per non rompere il layout
          });
        });

        // Info footer
        previewWrapper.createDiv({
          cls: 'base-preview-footer',
          text: `${rows.length} entries`
        });
      }
      else if (ext === 'json') {
        // JSON - mostra preview del codice
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
      }
    } catch (e) {
      console.error(e)
      containerEl.setText('Preview error');
    }
  }

}
