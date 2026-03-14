import { ItemView, WorkspaceLeaf, TFile, Menu, MarkdownRenderer } from "obsidian";
import { Finder, SearchResult, isCommand } from "./Finder";
import { i18n } from "./const";
import { Card, SearchBar } from "./component/Card";
import { ResultsContainer } from "./component/ui/ResultsContainer";
import { CodePreview } from "./component/ui/CodePreview";
import { HintBar } from "./component/ui/HintBar";

export const FINDER_VIEW_TYPE = "better-finder-view";

const PAGE_SIZE = 20;

export class FinderCard extends ItemView {
  private core: Finder;
  private resultsContainer: ResultsContainer;
  private searchBar: SearchBar;
  private hintBar: HintBar;
  private allResults: SearchResult[] = [];
  private renderedCount = 0;
  private sentinel: HTMLElement | null = null;
  private observer: IntersectionObserver | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.core = new Finder(this.app);
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
    this.destroyObserver();
    this.contentEl.empty();
  }

  private buildUI(): void {
    this.searchBar = new SearchBar(this.contentEl);

    this.hintBar = new HintBar(this.searchBar.containerEl);
    this.core.hints.forEach(hint => {
      this.hintBar.addHint(hint, (label) => {
        // eslint-disable-next-line prefer-template
        this.searchBar.setValue(label + ' ');
        this.searchBar.onFocus();
      });
    });

    const toggle = this.searchBar.createToggle();

    this.resultsContainer = new ResultsContainer(this.searchBar.containerEl, toggle);
    this.searchBar.onInput(() => this.onSearch());
    this.searchBar.onFocus();
  }

  private async onSearch(): Promise<void> {
    this.hintBar.highlightChips(this.core.getActiveHints(this.searchBar.getValue()));
    const results = await this.core.search(this.searchBar.getValue());

    this.prepareScrollResult(results);
  }

  private prepareScrollResult(results: SearchResult[]): void {
    this.destroyObserver();
    this.allResults = results;
    this.renderedCount = 0;
    this.resultsContainer.empty();
    this.sentinel = null;
    this.searchBar.setCounterElement(`${this.core.lastResultCount} ${i18n.results}`);
    this.loadMoreItems();
  }

  private renderResult(result: SearchResult): void {
    const card = new Card(this.resultsContainer.getElement());

    if (isCommand(result)) {
      this.core.renderCommand(result, card.getElement());
    } else {
      this.renderCard(result as TFile, card);
    }

    card.onClick(() => this.core.openResult(result));

    if (!isCommand(result)) {
      card.onContextMenu((event) => {
        event.preventDefault();
        const menu = new Menu();

        this.app.workspace.trigger('file-menu', menu, result as TFile, 'file-explorer-context-menu');
        menu.showAtMouseEvent(event);
      });
    }
  }

  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    if (entries[0].isIntersecting) {
      this.loadMoreItems();
    }
  }

  private loadMoreItems(): void {
    const batch = this.allResults.slice(this.renderedCount, this.renderedCount + PAGE_SIZE);

    batch.forEach(result => this.renderResult(result));
    this.renderedCount += batch.length;

    if (this.renderedCount < this.allResults.length) {
      this.attachSentinel();
    } else if (this.sentinel) {
      this.sentinel.remove();
      this.sentinel = null;
    }
  }

  private addElements(sentinel: HTMLElement): void {
    const options: IntersectionObserverInit = { threshold: 0 };

    this.observer = new IntersectionObserver(this.handleIntersection.bind(this), options);
    this.observer.observe(sentinel);
  }

  private attachSentinel(): void {
    if (this.sentinel) {
      this.sentinel.remove();
    }

    this.sentinel = this.resultsContainer.getElement().createDiv({ cls: 'finder-scroll-sentinel' });
    this.addElements(this.sentinel);
  }

  private destroyObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private renderCard(file: TFile, card: Card): void {
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
    containerEl.empty();
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

        new CodePreview(containerEl, rawContent.slice(0, 300));

        return;
      }

      await MarkdownRenderer.render(this.app, `![[${file.path}]]`, containerEl, '', this);
    } catch (e) {
      console.error('Preview error:', e);
      containerEl.setText('Preview not available');
    }
  }
}
