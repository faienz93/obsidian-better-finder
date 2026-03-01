import { App, SuggestModal, getAllTags, TFile } from "obsidian";
import { SearchStrategyFactory } from "./engine/SearchStrategy";
import { FinderCore, SearchResult, isCommand } from "./FinderCore";
import { FileItem } from "./component/FileItem";

class FinderModal extends SuggestModal<SearchResult> {
  private core: FinderCore;

  constructor(app: App) {
    super(app);
    this.core = new FinderCore(app);
  }

  onOpen(): void {
    const promptEl = this.modalEl.querySelector('.prompt-input-container');

    if (promptEl) {
      const hintWrapper = createDiv();

      promptEl.insertAdjacentElement('afterend', hintWrapper);
      this.core.renderHints(hintWrapper, (hint) => {
        // eslint-disable-next-line prefer-template
        this.inputEl.value = hint + ' ';
        this.inputEl.focus();
        this.inputEl.dispatchEvent(new Event('input'));
      });
    }

    // Update hints on input
    this.inputEl.addEventListener('input', () => {
      this.core.updateHintHighlights(this.inputEl.value);
    });
  }

  async getSuggestions(query: string): Promise<SearchResult[]> {
    return this.core.search(query);
  }

  // Renders each suggestion item
  renderSuggestion(result: SearchResult, el: HTMLElement) {
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
    const doneCount = tasks.filter(t => t.task === 'x' || t.task === 'X').length;

    const fileItem = new FileItem(el);

    fileItem.render({
      file,
      tags: fileTags,
      searchedTags: parsed.tags,
      taskInfo: parsed.taskFilter ? { done: doneCount, total: tasks.length } : undefined
    });
  }

  onChooseSuggestion(result: SearchResult) {
    this.core.handleSelection(result);
  }
}

export default FinderModal;
