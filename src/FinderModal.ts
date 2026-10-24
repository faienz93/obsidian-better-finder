import { App, Component, SuggestModal, TFile } from "obsidian";
import { Finder, SearchOutcome, SearchResult, isCommand } from "./Finder";
import { ModalUI } from "./component/Modal/ModalUI";
import { SearchUIHelper } from "./SearchUIHelper";
import { SearchHistory } from "./engine/SearchHistory";
import { LatestSearch } from "./engine/LatestSearch";
import { buildResultData } from "./engine/ResultData";
import { Body } from "./component/ui/Body";
import "./FinderModal.css";

class FinderModal extends SuggestModal<SearchResult> {
  private core: Finder;
  private latestSearch: LatestSearch;
  private uiHelper!: SearchUIHelper;
  // Rows are drawn from the search that settled, not from the input, which may already hold a newer query.
  private outcome: SearchOutcome | null = null;
  // Owns the markdown rendered by Previews, so it is released when the Modal closes.
  private previewComponent = new Component();
  private body: Body;

  constructor(app: App) {
    super(app);
    this.core = new Finder(app);
    this.latestSearch = new LatestSearch(this.core);
    this.body = new Body(app, this.previewComponent);
  }

  onOpen(): void {
    this.previewComponent.load();
    this.modalEl.addClass('better-finder-modal');
    const promptEl = this.modalEl.querySelector('.prompt-input-container');

    if (promptEl) {
      const hintWrapper = createDiv();

      promptEl.insertAdjacentElement('afterend', hintWrapper);
      this.uiHelper = new SearchUIHelper(this.app, this.core, hintWrapper, {
        onHintClick: (label) => this.appendToQuery(label),
        onDateFilterClick: (value) => this.applyDateValue(value),
      });
    }

    this.inputEl.addEventListener('input', () => {
      this.uiHelper?.onInput(this.inputEl.value, this.inputEl);
    });
  }

  onClose(): void {
    super.onClose();
    this.latestSearch.cancel();
    this.body.reset();
    this.previewComponent.unload();
    this.core.dispose();
  }

  async getSuggestions(query: string): Promise<SearchResult[]> {
    this.outcome = await this.latestSearch.run(query);
    // Obsidian redraws every Item for the new results: the old ones no longer need reading.
    this.body.reset();

    return this.outcome.results;
  }

  renderSuggestion(result: SearchResult, el: HTMLElement) {
    this.renderResult(result, el);
  }

  renderModalItem(result: SearchResult, el: HTMLElement) {
    this.renderResult(result, el);
  }

  onChooseSuggestion(result: SearchResult) {
    SearchHistory.getInstance().add(this.inputEl.value);
    this.core.openResult(result);
  }

  private renderResult(result: SearchResult, el: HTMLElement): void {
    el.empty();

    if (isCommand(result)) {
      this.core.renderCommand(result, el);

      return;
    }

    if (!this.outcome) return;

    new ModalUI(el, this.body).render(buildResultData(this.app, result as TFile, this.outcome));
  }

  private appendToQuery(token: string): void {
    const current = this.inputEl.value.split(' ').filter((w, i, arr) => w || i < arr.length - 1).join(' ');
    const alreadyPresent = current.toLowerCase().includes(token.toLowerCase());

    if (!alreadyPresent) {
      this.inputEl.value = current ? `${current} ${token} ` : `${token} `;
    }

    this.inputEl.dispatchEvent(new Event('input'));
    this.inputEl.focus();
  }

  private applyDateValue(value: string): void {
    this.inputEl.value = SearchUIHelper.toggleDateValue(this.inputEl.value, value);
    this.inputEl.dispatchEvent(new Event('input'));
    this.inputEl.focus();
  }
}

export default FinderModal;
