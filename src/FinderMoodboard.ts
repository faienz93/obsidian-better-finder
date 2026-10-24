import { ItemView, WorkspaceLeaf, TFile, Menu } from "obsidian";
import { Finder, SearchOutcome, SearchResult, isCommand } from "./Finder";
import { i18n } from "./const";
import { CardUI } from "./component/Card/CardUI";
import { SearchBar } from "./component/ui/SearchBar";
import { SearchUIHelper } from "./SearchUIHelper";
import { SearchHistory } from "./engine/SearchHistory";
import { LatestSearch } from "./engine/LatestSearch";
import { buildResultData } from "./engine/ResultData";

export const FINDER_VIEW_TYPE = "better-finder-view";

const PAGE_SIZE = 20;

export class FinderMoodboard extends ItemView {
  private core: Finder;
  private latestSearch: LatestSearch;
  private cardContainer!: CardUI;
  private searchBar!: SearchBar;
  private uiHelper!: SearchUIHelper;
  private outcome: SearchOutcome | null = null;
  private renderedCount = 0;
  private sentinel: HTMLElement | null = null;
  private observer: IntersectionObserver | null = null;
  private historyIndex = -1;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.core = new Finder(this.app);
    this.latestSearch = new LatestSearch(this.core);
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
    this.latestSearch.cancel();
    this.destroyObserver();
    this.cardContainer?.empty();
    this.core.dispose();
    this.contentEl.empty();
  }

  private buildUI(): void {
    this.searchBar = new SearchBar(this.contentEl);
    this.uiHelper = new SearchUIHelper(this.app, this.core, this.searchBar.containerEl, {
      onHintClick: (label) => this.appendToQuery(label),
      onDateFilterClick: (value) => this.applyDateValue(value),
    });

    const toggle = this.searchBar.createToggle();

    this.searchBar.createActionButton('⤓', i18n.exportButtonTitle, () => {
      this.core.exportResults(this.allResults, this.outcome?.parsed.rawInput ?? '').catch(console.error);
    });

    this.cardContainer = new CardUI(this.searchBar.containerEl, toggle, this.app, this);
    this.searchBar.onInput((event) => {
      // La digitazione manuale (evento trusted) esce dalla navigazione cronologia
      if (event?.isTrusted) {
        this.historyIndex = -1;
      }

      this.onSearch();
    });
    this.attachHistoryNavigation();
  }

  /** ↑/↓ navigano la cronologia ricerche, stile terminale */
  private attachHistoryNavigation(): void {
    this.searchBar.getInputEl().addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

      const history = SearchHistory.getInstance().getAll();

      if (history.length === 0) return;

      event.preventDefault();

      if (event.key === 'ArrowUp') {
        this.historyIndex = Math.min(this.historyIndex + 1, history.length - 1);
      } else {
        this.historyIndex = Math.max(this.historyIndex - 1, -1);
      }

      this.searchBar.setValue(this.historyIndex === -1 ? '' : history[this.historyIndex]);
    });
  }

  private async onSearch(): Promise<void> {
    this.uiHelper.onInput(this.searchBar.getValue(), this.searchBar.getInputEl());
    const outcome = await this.latestSearch.run(this.searchBar.getValue());

    this.prepareScrollResult(outcome);
  }

  private get allResults(): SearchResult[] {
    return this.outcome?.results ?? [];
  }

  private prepareScrollResult(outcome: SearchOutcome): void {
    const results = outcome.results;

    this.destroyObserver();
    this.outcome = outcome;
    this.renderedCount = 0;
    this.cardContainer.empty();
    this.sentinel = null;
    this.searchBar.setCounterElement(`${results.length} ${i18n.results}`);
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

    if (!this.outcome) return;

    const file = result as TFile;

    this.cardContainer.render(
      buildResultData(this.app, file, this.outcome),
      () => {
        SearchHistory.getInstance().add(this.searchBar.getValue());
        this.core.openResult(file);
      },
      (event) => this.showContextMenu(event, file)
    );
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
