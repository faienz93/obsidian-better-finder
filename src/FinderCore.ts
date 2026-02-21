import { App, TFile, getAllTags, Command } from "obsidian";
import { QueryParser } from "./QueryParser";
import { SearchIndex } from "./SearchIndex";
import { i18n } from "./const";
import { SearchStrategyFactory } from "./SearchStrategy";

export type SearchResult = TFile | Command;

// TODO non usato. cancellare
export function isFile(result: SearchResult): result is TFile {
  return 'stat' in result;
}

export function isCommand(result: SearchResult): result is Command {
  return 'id' in result && 'name' in result;
}

export class FinderCore {
  allFiles: TFile[];
  hintChips: Map<string, HTMLElement> = new Map();
  lastResultCount = 0;
  private app: App;
  private searchIndex: SearchIndex;
  private debounceTimer: number | null = null;
  private static readonly DEBOUNCE_MS = 150;

  constructor(app: App) {
    this.allFiles = app.vault.getFiles(); // Tutti i file, non solo markdown
    this.app = app;
    this.searchIndex = SearchIndex.getInstance(this.app);
  }

  // COPIATO DA FinderModal.renderHints() - adattato per usare container invece di modalEl
  renderHints(container: HTMLElement, onHintClick: (hint: string) => void): void {
    const hintBar = container.createDiv({ cls: 'hint-bar' });

    const hints = [
      { label: '#tag', desc: 'tag' },
      { label: 'today', desc: i18n.today },
      { label: 'this week', desc: i18n.thisWeek },
      { label: 'this month', desc: i18n.thisMonth },
      { label: '>', desc: i18n.commands },
      { label: 'title:', desc: i18n.title },
      { label: 'task:', desc: 'task' },
      { label: 'pdf', desc: 'PDF' },
      { label: 'image', desc: i18n.images },
      { label: 'canvas', desc: 'canvas' },
      { label: 'json', desc: 'json' },
      { label: 'base', desc: 'base' },
    ];

    hints.forEach(hint => {
      const chip = hintBar.createSpan({ cls: 'hint-chip' });

      chip.setText(hint.label);
      chip.setAttribute('title', hint.desc);
      this.hintChips.set(hint.label.toLowerCase(), chip);
      chip.addEventListener('click', () => {
        // this.inputEl.value = hint.label + ' ';
        // this.inputEl.focus();
        // this.onSearch();
        onHintClick(hint.label);
      });
    });
  }

  // COPIATO DA FinderModal.updateHintHighlights()
  updateHintHighlights(query: string): void {
    // const query = this.inputEl.value.toLowerCase();
    const queryLowerCase = query.toLowerCase();

    this.hintChips.forEach((chip, label) => {
      const isActive = queryLowerCase.includes(label) ||
        (label === '#tag' && !!queryLowerCase.match(/#\w+/)) ||
        (label === 'task:' && queryLowerCase.includes('task:'));

      chip.toggleClass('hint-chip-active', isActive);
    });
  }

  // COPIATO DA FinderModal.getCommandSuggestions()
  getCommandSuggestions(searchText: string): Command[] {
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
  async getResults(query: string): Promise<SearchResult[]> {
    const test = SearchStrategyFactory.getInstance()
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

    // 4. Filter by scope / free text search
    if (parsed.freeText) {
      if (parsed.scope === 'title') {
        results = this.searchIndex.searchInTitlesWithoutIndex(parsed.freeText, results);
      } else {
        const isMarkdownOnly = parsed.fileTypes.length === 0 ||
          parsed.fileTypes.every(ext => ext === '.md');

        if (this.searchIndex?.isIndexReady() && isMarkdownOnly) {
          // MiniSearch: ricerca indicizzata veloce
          const indexResults = this.searchIndex.search(parsed.freeText, 50);
          // Intersezione con risultati pre-filtrati (tag, date, task)
          const resultPaths = new Set(results.map(f => f.path));

          results = indexResults.filter(f => resultPaths.has(f.path));
        } else {
          // Fallback per non-markdown o indice non pronto
          results = await this.searchIndex.searchFilesWithoutIndex(parsed, results);
        }
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

    if (!parsed.freeText) {
      results.sort((a, b) => b.stat.mtime - a.stat.mtime);
    }

    return results.slice(0, 50);
  }

  renderCommand(command: Command, el: HTMLElement): void {
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

  async search(query: string): Promise<SearchResult[]> {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    return new Promise<SearchResult[]>((resolve) => {
      this.debounceTimer = window.setTimeout(async () => {
        this.debounceTimer = null;
        const results = await this.getResults(query);

        this.lastResultCount = results.length;
        resolve(results);
      }, FinderCore.DEBOUNCE_MS);
    });
  }

  handleSelection(result: SearchResult): void {
    if (isCommand(result)) {
      (this.app as any).commands.executeCommandById(result.id);

      return;
    }

    const file = result as TFile;

    this.app.workspace.getLeaf(false).openFile(file);
  }
}
