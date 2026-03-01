import { ItemView, WorkspaceLeaf, TFile, Menu } from "obsidian";
import { FinderCore, SearchResult, isCommand } from "./FinderController";
import { i18n } from "./const";
import { Card, SearchBar } from "./component/Card";
import { ResultsContainer } from "./component/ui/ResultsContainer";

export const FINDER_VIEW_TYPE = "better-finder-view";

export class FinderCard extends ItemView {
  private core: FinderCore;
  private resultsContainer: ResultsContainer;
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
    this.searchBar = new SearchBar(this.contentEl);

    this.core.renderHints(this.searchBar.containerEl, (hint) => {
      this.searchBar.setValue(`${hint} `);
      this.searchBar.onFocus();
      this.onSearch();
    });

    const toggle = this.searchBar.createToggle();

    this.resultsContainer = new ResultsContainer(this.searchBar.containerEl, toggle);
    this.searchBar.onInput(() => this.onSearch());
    this.searchBar.onFocus();
  }

  private async onSearch(): Promise<void> {
    this.core.updateHintHighlights(this.searchBar.getValue());
    const results = await this.core.search(this.searchBar.getValue());

    this.renderResults(results);
  }

  private renderResults(results: SearchResult[]): void {
    this.resultsContainer.empty();
    this.searchBar.setCounterElement(`${this.core.lastResultCount} ${i18n.results}`);

    results.forEach(result => {
      const card = new Card(this.resultsContainer.getElement());

      if (isCommand(result)) {
        this.core.renderCommand(result, card.getElement());
      } else {
        this.renderFile(result as TFile, card);
      }

      card.onClick(() => this.core.handleSelection(result));

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

    card.renderPreview(file, this.app, this);

    card.setMetadata(
      new Date(file.stat.mtime).toLocaleDateString(),
      file.parent?.path || '/'
    );
  }
}
