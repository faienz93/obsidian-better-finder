import { ItemView, WorkspaceLeaf, TFile, Menu, getAllTags } from "obsidian";
import { Finder, SearchResult, isCommand } from "./Finder";
import { i18n } from "./const";
import { Card } from "./component/interface/Card";
import { CardUI } from "./component/Card/CardUI";
import { SearchBar } from "./component/ui/SearchBar";
import { SearchUIHelper } from "./SearchUIHelper";

export const FINDER_VIEW_TYPE = "better-finder-view";

const PAGE_SIZE = 20;

export class FinderCard extends ItemView {
  private core: Finder;
  private cardContainer!: CardUI;
  private searchBar!: SearchBar;
  private uiHelper!: SearchUIHelper;
  private allResults: SearchResult[] = [];
  private renderedCount = 0;
  private sentinel: HTMLElement | null = null;
  private observer: IntersectionObserver | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.core = new Finder(this.app);
    // Registra la view nella history di navigazione: aprendo un file dalla
    // stessa leaf, il pulsante "indietro" riporta al finder.
    this.navigation = true;
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
      onDateFilterClick: (value) => this.applyDateValue(value),
    });

    const toggle = this.searchBar.createToggle();

    this.cardContainer = new CardUI(this.searchBar.containerEl, toggle, this.app, this);
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
    this.cardContainer.empty();
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

    batch.forEach(result => this.renderResult(result));
    this.renderedCount += batch.length;

    if (this.renderedCount < this.allResults.length) {
      this.attachSentinel();
    } else if (this.sentinel) {
      this.sentinel.remove();
      this.sentinel = null;
    }
  }

  private renderResult(result: SearchResult): void {
    if (isCommand(result)) {
      this.core.renderCommand(result, this.cardContainer.getElement().createDiv());

      return;
    }

    const file = result as TFile;

    this.cardContainer.render(
      this.buildCardData(file),
      () => this.core.openResult(file),
      (event) => this.showContextMenu(event, file)
    );
  }

  private buildCardData(file: TFile): Card {
    const fileCache = this.app.metadataCache.getFileCache(file);
    const fileTags = fileCache ? getAllTags(fileCache) || [] : [];
    const tasks = fileCache?.listItems?.filter(i => i.task) || [];
    const doneCount = tasks.filter(t => (t.task as string) === 'x' || (t.task as string) === 'X').length;

    return {
      file,
      tags: fileTags,
      searchedTags: [],
      taskInfo: tasks.length > 0 ? { done: doneCount, total: tasks.length } : undefined,
    };
  }

  private showContextMenu(event: MouseEvent, file: TFile): void {
    event.preventDefault();
    const menu = new Menu();

    this.app.workspace.trigger('file-menu', menu, file, 'file-explorer-context-menu');
    menu.showAtMouseEvent(event);
  }

  private attachSentinel(): void {
    if (this.sentinel) {
      this.sentinel.remove();
    }

    this.sentinel = this.cardContainer.getElement().createDiv({ cls: 'finder-scroll-sentinel' });
    this.observer = new IntersectionObserver(this.handleIntersection.bind(this), { threshold: 0 });
    this.observer.observe(this.sentinel);
  }

  private appendToQuery(token: string): void {
    const raw = this.searchBar.getValue();
    const current = raw.split(' ').filter((w, i, arr) => w || i < arr.length - 1).join(' ');
    const alreadyPresent = current.toLowerCase().includes(token.toLowerCase());

    if (!alreadyPresent) {
      this.searchBar.setValue(current ? `${current} ${token} ` : `${token} `);
    }
  }

  private applyDateValue(value: string): void {
    this.searchBar.setValue(SearchUIHelper.toggleDateValue(this.searchBar.getValue(), value));
  }

  private destroyObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
