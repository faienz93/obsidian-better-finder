import { ItemView, WorkspaceLeaf, TFile, Menu } from "obsidian";
import { Finder, SearchResult, isCommand } from "./Finder";
import { i18n } from "./const";
import { Card, SearchBar } from "./component/Card";
import { ResultsContainer } from "./component/ui/ResultsContainer";
import { ImagePreview } from "./component/ui/ImagePreview";
import { SearchUIHelper } from "./SearchUIHelper";

export const FINDER_VIEW_TYPE = "better-finder-view";

const PAGE_SIZE = 20;

export class FinderCard extends ItemView {
  private core: Finder;
  private resultsContainer!: ResultsContainer;
  private searchBar!: SearchBar;
  private uiHelper!: SearchUIHelper;
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
    this.uiHelper = new SearchUIHelper(this.app, this.core, this.searchBar.containerEl, {
      onHintClick: (label) => this.appendToQuery(label),
      onDateFilterClick: (value) => this.appendToQuery(value),
    });

    const toggle = this.searchBar.createToggle();

    this.resultsContainer = new ResultsContainer(this.searchBar.containerEl, toggle);
    this.searchBar.onInput(() => this.onSearch());
  }

  private async onSearch(): Promise<void> {
    this.uiHelper.onInput(this.searchBar.getValue(), this.searchBar.getInputEl());
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

  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    if (entries[0].isIntersecting) {
      this.loadMoreItems();
    }
  }

  private loadMoreItems(): void {
    const batch = this.allResults.slice(this.renderedCount, this.renderedCount + PAGE_SIZE);

    batch.forEach(result => {
      const el = this.resultsContainer.getElement().createDiv();

      this.renderResult(result, el);
    });
    this.renderedCount += batch.length;

    if (this.renderedCount < this.allResults.length) {
      this.attachSentinel();
    } else if (this.sentinel) {
      this.sentinel.remove();
      this.sentinel = null;
    }
  }

  private renderResult(result: SearchResult, el: HTMLElement): void {
    const card = new Card(el);

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

  private renderCard(file: TFile, card: Card): void {
    card.setSuggestionItem();

    const title = card.setTitle(file.basename);

    if (file.extension !== 'md') {
      card.setBadge(title, file.extension.toUpperCase());
    }

    new ImagePreview(this.app, this).load(file, card.getPreviewContainer());

    card.setMetadata(
      new Date(file.stat.mtime).toLocaleDateString(),
      file.parent?.path || '/'
    );
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

  private appendToQuery(token: string): void {
    const raw = this.searchBar.getValue();
    const current = raw.split(' ').filter((w, i, arr) => w || i < arr.length - 1).join(' ');
    const alreadyPresent = current.toLowerCase().includes(token.toLowerCase());

    if (!alreadyPresent) {
      this.searchBar.setValue(current ? `${current} ${token} ` : `${token} `);
    }
  }

  private destroyObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
