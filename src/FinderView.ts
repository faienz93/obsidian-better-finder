import { ItemView, WorkspaceLeaf, TFile, Command, getAllTags } from "obsidian";
import { QueryParser, ParsedQuery } from "./QueryParser";
import { SearchEngine } from "./SearchEngine";

export const FINDER_VIEW_TYPE = "better-finder-view";

type SearchResult = TFile | Command;

function isFile(result: SearchResult): result is TFile {
  return 'stat' in result;
}

function isCommand(result: SearchResult): result is Command {
  return 'id' in result && 'name' in result;
}

export class FinderView extends ItemView {
  private searchEngine: SearchEngine;
  private inputEl: HTMLInputElement;
  private resultsEl: HTMLElement;
  private hintChips: Map<string, HTMLElement> = new Map();
  private allFiles: TFile[];

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
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
    this.searchEngine = new SearchEngine(this.app);
    this.allFiles = this.app.vault.getFiles();
    this.buildUI();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  private buildUI(): void {
    const container = this.contentEl.createDiv({ cls: "finder-view-container" });

    // Input di ricerca
    this.inputEl = container.createEl("input", {
      type: "text",
      placeholder: "Search files...",
      cls: "finder-view-input"
    });

    // Hint bar (copiato da FinderModal)
    this.renderHints(container);

    // Container risultati
    this.resultsEl = container.createDiv({ cls: "finder-view-results" });

    // Event listener per input con debounce
    let debounceTimer: number;
    this.inputEl.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => this.onSearch(), 150);
    });

    this.inputEl.focus();
  }

  // COPIATO DA FinderModal.renderHints() - adattato per usare container invece di modalEl
  private renderHints(container: HTMLElement): void {
    const hintBar = container.createDiv({ cls: 'hint-bar' });

    const hints = [
      { label: '#tag', desc: 'tag' },
      { label: 'today', desc: 'oggi' },
      { label: 'this week', desc: 'settimana' },
      { label: 'this month', desc: 'mese' },
      { label: '>', desc: 'comandi' },
      { label: 'title:', desc: 'titolo' },
      { label: 'task:', desc: 'task' },
      { label: 'pdf', desc: 'PDF' },
      { label: 'image', desc: 'immagini' },
      { label: 'canvas', desc: 'canvas' },
    ];

    hints.forEach(hint => {
      const chip = hintBar.createSpan({ cls: 'hint-chip' });
      chip.setText(hint.label);
      chip.setAttribute('title', hint.desc);
      this.hintChips.set(hint.label.toLowerCase(), chip);
      chip.addEventListener('click', () => {
        this.inputEl.value = hint.label + ' ';
        this.inputEl.focus();
        this.onSearch();
      });
    });
  }

  // COPIATO DA FinderModal.updateHintHighlights()
  private updateHintHighlights(): void {
    const query = this.inputEl.value.toLowerCase();

    this.hintChips.forEach((chip, label) => {
      const isActive = query.includes(label) ||
        (label === '#tag' && !!query.match(/#\w+/)) ||
        (label === 'task:' && query.includes('task:'));

      chip.toggleClass('hint-chip-active', isActive);
    });
  }

  private async onSearch(): Promise<void> {
    this.updateHintHighlights();
    const query = this.inputEl.value;
    const results = await this.getResults(query);
    this.renderResults(results);
  }

  // COPIATO DA FinderModal.getCommandSuggestions()
  private getCommandSuggestions(searchText: string): Command[] {
    const allCommands = (this.app as any).commands.listCommands() as Command[];

    if (!searchText) {
      return allCommands;
    }

    const lowerSearch = searchText.toLowerCase();
    return allCommands.filter(cmd =>
      cmd.name.toLowerCase().includes(lowerSearch) ||
      (cmd.id && cmd.id.toLowerCase().includes(lowerSearch))
    );
  }

  // COPIATO DA FinderModal.getSuggestions()
  private async getResults(query: string): Promise<SearchResult[]> {
    const parsed = QueryParser.parse(query);

    if (parsed.isCommandMode) {
      return this.getCommandSuggestions(parsed.commandText || '');
    }

    let results: TFile[] = this.allFiles;

    // 1. Filter by file types
    if (parsed.fileTypes.length > 0) {
      results = results.filter(file =>
        parsed.fileTypes.some(ext => file.extension === ext.slice(1))
      );
    } else {
      results = results.filter(file => file.extension === 'md');
    }

    // 2. Filter by tags
    if (parsed.tags.length > 0) {
      results = results.filter(file => {
        const fileCache = this.app.metadataCache.getFileCache(file);
        if (!fileCache) return false;
        const fileTags = getAllTags(fileCache) || [];
        return parsed.tags.every(tag => fileTags.includes(tag));
      });
    }

    // 3. Filter by date
    if (parsed.dateFilter) {
      results = results.filter(file => {
        const fileDate = new Date(file.stat.mtime);
        switch (parsed.dateFilter) {
          case 'today': return QueryParser.isToday(fileDate);
          case 'this-week': return QueryParser.isThisWeek(fileDate);
          case 'this-month': return QueryParser.isThisMonth(fileDate);
          default: return true;
        }
      });
    }

    // 4. Filter by scope
    if (parsed.freeText) {
      if (parsed.scope === 'title') {
        results = this.searchEngine.searchInTitles(parsed.freeText, results);
      } else {
        results = await this.searchEngine.searchFiles(parsed, results);
      }
    } else {
      results.sort((a, b) => b.stat.mtime - a.stat.mtime);
    }

    // 5. Filter by tasks
    if (parsed.taskFilter) {
      results = results.filter(file => {
        if (file.extension !== 'md') return false;
        const fileCache = this.app.metadataCache.getFileCache(file);
        if (!fileCache || !fileCache.listItems) return false;
        const tasks = fileCache.listItems.filter(item => item.task);
        if (tasks.length === 0) return false;
        switch (parsed.taskFilter) {
          case 'all': return true;
          case 'todo': return tasks.some(t => t.task !== 'x' && t.task !== 'X');
          case 'done': return tasks.some(t => t.task === 'x' || t.task === 'X');
          default: return true;
        }
      });
    }

    results.sort((a, b) => b.stat.mtime - a.stat.mtime);
    return results;
  }

  private renderResults(results: SearchResult[]): void {
    this.resultsEl.empty();

    results.forEach(result => {
      const el = this.resultsEl.createDiv({ cls: 'finder-view-result' });

      if (isCommand(result)) {
        this.renderCommand(result, el);
      } else {
        this.renderFile(result as TFile, el);
      }

      el.addEventListener('click', () => this.onSelectResult(result));
    });
  }

  // COPIATO DA FinderModal.renderCommand()
  private renderCommand(command: Command, el: HTMLElement): void {
    el.addClass('suggestion-item');

    const titleEl = el.createDiv({ cls: 'suggestion-title' });
    titleEl.createSpan({ text: command.name });

    if (command.icon) {
      const iconEl = titleEl.createSpan({ cls: 'suggestion-flair' });
      iconEl.style.marginLeft = '8px';
      iconEl.setText(command.icon);
    }

    const metaRow = el.createDiv({ cls: 'suggestion-note' });
    metaRow.style.fontSize = '11px';
    metaRow.style.color = 'var(--text-muted)';
    metaRow.style.marginTop = '4px';
    metaRow.setText(command.id);

    const hotkeys = (this.app as any).hotkeyManager.getHotkeys(command.id);
    if (hotkeys && hotkeys.length > 0) {
      const hotkeyEl = el.createDiv();
      hotkeyEl.style.marginTop = '4px';
      hotkeyEl.style.fontSize = '11px';
      hotkeyEl.style.color = 'var(--text-accent)';

      const hotkeyText = hotkeys.map((hk: any) => {
        const modifiers = [];
        if (hk.modifiers.includes('Mod')) modifiers.push('Ctrl');
        if (hk.modifiers.includes('Shift')) modifiers.push('Shift');
        if (hk.modifiers.includes('Alt')) modifiers.push('Alt');
        return [...modifiers, hk.key].join('+');
      }).join(', ');

      hotkeyEl.setText(`⌨️ ${hotkeyText}`);
    }
  }

  // COPIATO DA FinderModal.renderSuggestion() - parte file
  private renderFile(file: TFile, el: HTMLElement): void {
    const parsed = QueryParser.parse(this.inputEl.value);
    el.addClass('suggestion-item');

    const titleEl = el.createDiv({ cls: 'suggestion-title' });
    titleEl.createSpan({ text: file.basename });

    if (file.extension !== 'md') {
      const extBadge = titleEl.createSpan({
        text: file.extension.toUpperCase(),
        cls: 'suggestion-flair'
      });
      extBadge.style.marginLeft = '8px';
      extBadge.style.fontSize = '10px';
      extBadge.style.padding = '2px 6px';
      extBadge.style.background = 'var(--background-modifier-success)';
      extBadge.style.borderRadius = '3px';
    }

    const metaRow = el.createDiv({ cls: 'suggestion-note' });
    metaRow.style.display = 'flex';
    metaRow.style.gap = '12px';
    metaRow.style.fontSize = '11px';
    metaRow.style.color = 'var(--text-muted)';
    metaRow.style.marginTop = '4px';

    const dateEl = metaRow.createSpan();
    dateEl.setText(new Date(file.stat.mtime).toLocaleDateString());

    const pathEl = metaRow.createSpan();
    pathEl.setText(file.parent?.path || '/');

    if (file.extension === 'md') {
      const fileCache = this.app.metadataCache.getFileCache(file);
      if (fileCache) {
        const fileTags = getAllTags(fileCache) || [];

        if (fileTags.length > 0) {
          const tagsContainer = el.createDiv();
          tagsContainer.style.marginTop = '8px';
          tagsContainer.style.display = 'flex';
          tagsContainer.style.gap = '4px';
          tagsContainer.style.flexWrap = 'wrap';

          const searchedTags = parsed.tags;

          fileTags.forEach(tag => {
            const tagEl = tagsContainer.createSpan({ text: tag });
            tagEl.style.background = 'var(--tag-background)';
            tagEl.style.color = 'var(--tag-color)';
            tagEl.style.padding = '2px 6px';
            tagEl.style.borderRadius = '4px';
            tagEl.style.fontSize = '11px';

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

        if (parsed.taskFilter && fileCache.listItems) {
          const tasks = fileCache.listItems.filter(item => item.task);
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

  // COPIATO DA FinderModal.onChooseSuggestion()
  private onSelectResult(result: SearchResult): void {
    if (isCommand(result)) {
      (this.app as any).commands.executeCommandById(result.id);
      return;
    }

    const file = result as TFile;
    const leaf = this.app.workspace.getLeaf(false);
    leaf.openFile(file);
  }
}
