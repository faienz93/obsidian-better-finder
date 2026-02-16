import { ItemView, WorkspaceLeaf, TFile, MarkdownRenderer, Menu } from "obsidian";
import { FinderCore, SearchResult, isCommand } from "./FinderCore";
import { i18n } from "./const";
import { Card, ToggleButton, SearchBar } from "./component/Card";

export const FINDER_VIEW_TYPE = "better-finder-view";



export class FinderView extends ItemView {
  private core: FinderCore;
  private resultsEl: HTMLElement;
  private searchBar: SearchBar;


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
    this.searchBar = new SearchBar(headerEl);

    // Toggle view button
    const toggle = new ToggleButton(headerEl);
    toggle.onClick((isGridView) => {
      this.resultsEl.toggleClass("grid-view", isGridView);
      this.resultsEl.toggleClass("list-view", !isGridView);
    });

    // Hint bar
    this.core.renderHints(container, (hint) => {
      this.searchBar.setValue(hint + ' ')
      this.searchBar.onFocus();
      this.onSearch();
    });

    // TODO Container dei risultati
    this.resultsEl = container.createDiv({ cls: "finder-view-results grid-view" });
    this.searchBar.onInput(() => this.onSearch())
    this.searchBar.onFocus();
  }

  private async onSearch(): Promise<void> {
    this.core.updateHintHighlights(this.searchBar.getValue());
    const results = await this.core.search(this.searchBar.getValue());
    this.renderResults(results);
  }

  private renderResults(results: SearchResult[]): void {
    this.resultsEl.empty();
    this.searchBar.setCounterElement(`${this.core.lastResultCount} ${i18n.results}`)

    results.forEach(result => {
      const card = new Card(this.resultsEl);
      // TODO refactor
      if (isCommand(result)) {
        this.core.renderCommand(result, card.getElement());
      } else {
        this.renderFile(result as TFile, card);
      }

      card.onClick(() => this.core.handleSelection(result))

      if (!isCommand(result)) {
        card.onContextMenu((event) => {
          event.preventDefault();
          const menu = new Menu();
          this.app.workspace.trigger('file-menu', menu, result as TFile, 'file-explorer-context-menu');
          menu.showAtMouseEvent(event);
        });
      }
    });
  }


  private renderFile(file: TFile, card: Card): void {
    card.setSuggestionItem();

    const title = card.setTitle(file.basename);
    if (file.extension !== 'md') {
      card.setBadge(title, file.extension.toUpperCase());
    }

    this.loadPreview(file, card.getPreviewContainer());

    card.setMetadata(
      new Date(file.stat.mtime).toLocaleDateString(),
      file.parent?.path || '/'
    );
  }

  private async loadPreview(file: TFile, containerEl: HTMLElement): Promise<void> {
    // TODO questi vorrei che fossero componenti della class card e vorrei un istanziazione globale della card (forse?)
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

      // Fallback
      await MarkdownRenderer.render(this.app, `![[${file.path}]]`, containerEl, '', this);
    } catch (e) {
      console.error('Preview error:', e);
      containerEl.setText('Preview not available');
    }
  }

}
