import { App, SuggestModal, getAllTags, TFile } from "obsidian";
import { Finder, SearchResult, isCommand } from "./Finder";
import { ModalUI } from "./component/Modal/ModalUI";
import { SearchStrategyFactory } from "./engine/SearchStrategy";
import { SearchUIHelper } from "./SearchUIHelper";
import "./FinderModal.css";

const PREVIEW_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'canvas', 'pdf', 'docx', 'xlsx'];

class FinderModal extends SuggestModal<SearchResult> {
  private core: Finder;
  private uiHelper!: SearchUIHelper;

  constructor(app: App) {
    super(app);
    this.core = new Finder(app);
  }

  onOpen(): void {
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

  async getSuggestions(query: string): Promise<SearchResult[]> {
    return this.core.search(query);
  }

  renderSuggestion(result: SearchResult, el: HTMLElement) {
    this.renderResult(result, el);
  }

  renderModalItem(result: SearchResult, el: HTMLElement) {
    this.renderResult(result, el);
  }

  onChooseSuggestion(result: SearchResult) {
    this.core.openResult(result);
  }

  private renderResult(result: SearchResult, el: HTMLElement): void {
    el.empty();

    if (isCommand(result)) {
      this.core.renderCommand(result, el);

      return;
    }

    const file = result as TFile;
    const parsed = SearchStrategyFactory.getInstance().parse(this.inputEl.value);
    const fileCache = this.app.metadataCache.getFileCache(file);
    const fileTags = fileCache ? getAllTags(fileCache) || [] : [];
    const tasks = fileCache?.listItems?.filter(i => i.task) || [];
    const doneCount = tasks.filter((t: any) => t.task === 'x' || t.task === 'X').length;
    const ext = file.extension.toLowerCase();
    const isExcalidraw = ext === 'md' && fileCache?.frontmatter?.['excalidraw-plugin'] === 'parsed';
    const renderPreview = PREVIEW_EXTENSIONS.includes(ext) || isExcalidraw;

    new ModalUI(el, this.app).render({
      file,
      tags: fileTags,
      searchedTags: parsed.tags,
      taskInfo: parsed.taskFilter ? { done: doneCount, total: tasks.length } : undefined,
      renderPreview,
      snippetTerm: ext === 'md' && parsed.freeText ? parsed.freeText : undefined,
    });
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
