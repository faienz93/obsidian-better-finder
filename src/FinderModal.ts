import { App, SuggestModal, getAllTags } from "obsidian";
import { SearchStrategyFactory } from "./SearchStrategy";
import { FinderCore, SearchResult, isCommand } from "./FinderCore";
import { SuggestionItem } from "./component/Card";

class FinderModal extends SuggestModal<SearchResult> {
  private core: FinderCore;

  constructor(app: App) {
    super(app);
    this.core = new FinderCore(app);
  }

  onOpen(): void {
    // Hint bar - inserita dopo .prompt-input-container
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

    const parsed = SearchStrategyFactory.getInstance().parse(this.inputEl.value);
    const item = new SuggestionItem(el);
    const title = item.setTitle(result.basename);

    if (result.extension !== 'md') {
      item.setBadge(title, result.extension.toUpperCase());
    }

    item.setMetadata(
      new Date(result.stat.mtime).toLocaleDateString(),
      result.parent?.path || '/'
    );

    if (result.extension === 'md') {
      const fileCache = this.app.metadataCache.getFileCache(result);

      if (fileCache) {
        const fileTags = getAllTags(fileCache) || [];

        item.setTags(fileTags, parsed.tags);

        if (parsed.taskFilter && fileCache.listItems) {
          const tasks = fileCache.listItems.filter(i => i.task);
          const doneCount = tasks.filter(t => t.task === 'x' || t.task === 'X').length;

          if (tasks.length > 0) {
            item.setTaskBadge(doneCount, tasks.length);
          }
        }
      }
    }
  }

  onChooseSuggestion(result: SearchResult) {
    this.core.handleSelection(result);
  }
}

export default FinderModal;
