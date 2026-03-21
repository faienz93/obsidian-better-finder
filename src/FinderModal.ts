import { App, SuggestModal, getAllTags, TFile } from "obsidian";
import { SearchStrategyFactory } from "./engine/SearchStrategy";
import { Finder, SearchResult, isCommand } from "./Finder";
import { ModalItem } from "./component/ModalItem";
import { HintBar } from "./component/ui/HintBar";
import { SubHintBar } from "./component/ui/SubHintBar";

class FinderModal extends SuggestModal<SearchResult> {
  private core: Finder;
  private hintBar: HintBar;
  private subHintBar: SubHintBar;

  constructor(app: App) {
    super(app);
    this.core = new Finder(app);
  }

  onOpen(): void {
    const promptEl = this.modalEl.querySelector('.prompt-input-container');

    if (promptEl) {
      const hintWrapper = createDiv();

      promptEl.insertAdjacentElement('afterend', hintWrapper);
      this.hintBar = new HintBar(hintWrapper);
      this.core.hints.forEach(hint => {
        this.hintBar.addHint(hint, (label) => {
          // eslint-disable-next-line prefer-template
          this.inputEl.value = label + ' ';
          this.inputEl.focus();
          this.inputEl.dispatchEvent(new Event('input'));
        });
      });

      this.subHintBar = new SubHintBar(hintWrapper, (value) => {
        const current = this.inputEl.value;
        const match = /\b(modified|created):(\S*)/.exec(current);

        if (match) {
          this.inputEl.value = current.slice(0, match.index) + match[1] + ':' + value + current.slice(match.index + match[0].length);
        } else {
          this.inputEl.value = current.trimEnd() + ' modified:' + value + ' ';
        }

        this.inputEl.focus();
        this.inputEl.dispatchEvent(new Event('input'));
      });
    }

    this.inputEl.addEventListener('input', () => {
      const query = this.inputEl.value;
      const factory = SearchStrategyFactory.getInstance();

      this.hintBar?.highlightChips(this.core.getActiveHints(query));

      const parsed = factory.parse(query);

      if (parsed.dateFilter) {
        this.subHintBar?.show(parsed.dateFilter.value);
      } else if (/\b(modified|created):/.test(query)) {
        this.subHintBar?.show();
      } else {
        this.subHintBar?.hide();
      }
    });
  }

  async getSuggestions(query: string): Promise<SearchResult[]> {
    return this.core.search(query);
  }

  // Renders each suggestion item (called by older Obsidian versions)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderSuggestion(result: SearchResult, el: HTMLElement) {
    this.renderModalItem(result, el);
  }

  // Renders each suggestion item
  renderModalItem(result: SearchResult, el: HTMLElement) {
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

    const modal = new ModalItem(el);

    modal.render({
      file,
      tags: fileTags,
      searchedTags: parsed.tags,
      taskInfo: parsed.taskFilter ? { done: doneCount, total: tasks.length } : undefined
    });
  }

  onChooseSuggestion(result: SearchResult) {
    this.core.openResult(result);
  }
}

export default FinderModal;
