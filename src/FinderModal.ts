import { App, SuggestModal, getAllTags } from "obsidian";
import { QueryParser } from "./QueryParser";
import { FinderCore, SearchResult, isCommand } from "./FinderCore";
import { SearchIndex } from "./SearchIndex";

class FinderModal extends SuggestModal<SearchResult> {
  private core: FinderCore;

  constructor(app: App, searchIndex?: SearchIndex) {
    super(app);
    this.core = new FinderCore(app, searchIndex);
  }

  onOpen(): void {
    // Hint bar - inserita dopo .prompt-input-container
    const promptEl = this.modalEl.querySelector('.prompt-input-container');
    if (promptEl) {
      const hintWrapper = createDiv();
      promptEl.insertAdjacentElement('afterend', hintWrapper);
      this.core.renderHints(hintWrapper, (hint) => {
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
    // Clear the element
    el.empty();

    if (isCommand(result)) {
      this.core.renderCommand(result, el);
      return;
    }

    // RENDER FILE (existing code)
    // const file = result as TFile;

    // Parse query once at the beginning
    const parsed = QueryParser.parse(this.inputEl.value);

    // Add class to el directly instead of creating nested container
    el.addClass('suggestion-item');

    // File name (title)
    const titleEl = el.createDiv({ cls: 'suggestion-title' });
    titleEl.createSpan({ text: result.basename });

    // File extension badge (if not markdown)
    if (result.extension !== 'md') {
      const extBadge = titleEl.createSpan({
        text: result.extension.toUpperCase(),
        cls: 'suggestion-flair'
      });
      extBadge.style.marginLeft = '8px';
      extBadge.style.fontSize = '10px';
      extBadge.style.padding = '2px 6px';
      extBadge.style.background = 'var(--background-modifier-success)';
      extBadge.style.borderRadius = '3px';
    }

    // Metadata row (date + path)
    const metaRow = el.createDiv({ cls: 'suggestion-note' });
    metaRow.style.display = 'flex';
    metaRow.style.gap = '12px';
    metaRow.style.fontSize = '11px';
    metaRow.style.color = 'var(--text-muted)';
    metaRow.style.marginTop = '4px';

    // Date
    const dateEl = metaRow.createSpan();
    dateEl.setText(new Date(result.stat.mtime).toLocaleDateString());

    // Path
    const pathEl = metaRow.createSpan();
    pathEl.setText(result.parent?.path || '/');

    // Tags (only for markdown files)
    if (result.extension === 'md') {
      const fileCache = this.app.metadataCache.getFileCache(result);
      if (fileCache) {
        const fileTags = getAllTags(fileCache) || [];

        if (fileTags.length > 0) {
          const tagsContainer = el.createDiv();
          tagsContainer.style.marginTop = '8px';
          tagsContainer.style.display = 'flex';
          tagsContainer.style.gap = '4px';
          tagsContainer.style.flexWrap = 'wrap';

          // Use parsed tags from the beginning of the method
          const searchedTags = parsed.tags;

          fileTags.forEach(tag => {
            const tagEl = tagsContainer.createSpan({ text: tag });
            tagEl.style.background = 'var(--tag-background)';
            tagEl.style.color = 'var(--tag-color)';
            tagEl.style.padding = '2px 6px';
            tagEl.style.borderRadius = '4px';
            tagEl.style.fontSize = '11px';

            // Highlight if tag matches search
            const isMatched = searchedTags.some(searchTag =>
              tag.toLowerCase() === searchTag.toLowerCase()
            );

            if (isMatched) {
              tagEl.style.background = 'var(--interactive-accent)';
              tagEl.style.color = 'var(--text-on-accent)';
              tagEl.style.fontWeight = '600';
            }
          });
        }

        // Show task count if filtering by tasks
        if (parsed.taskFilter && fileCache.listItems) {
          const tasks = fileCache.listItems.filter(item => item.task);
          // const todoCount = tasks.filter(t => t.task !== 'x' && t.task !== 'X').length;
          const doneCount = tasks.filter(t => t.task === 'x' || t.task === 'X').length;

          if (tasks.length > 0) {
            const taskBadge = el.createDiv();
            taskBadge.style.marginTop = '6px';
            taskBadge.style.fontSize = '11px';
            taskBadge.style.color = 'var(--text-muted)';
            taskBadge.setText(`✓ ${doneCount}/${tasks.length} tasks completed`);
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
