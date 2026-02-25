import { App, TFile, Command } from "obsidian";
import { isFilterable, SearchStrategyFactory, SearchStrategyInterface } from "./SearchStrategy";
import { SearchIndex } from "./SearchIndex";
import { i18n } from "./const";
// import { ParsedQuery } from "./QueryParser";

export type SearchResult = TFile | Command;

export type HintsType = { label: string, desc: string, strategy: SearchStrategyInterface<unknown> }[]

// TODO non usato. NON CANCELLARE
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
  private factory = SearchStrategyFactory.getInstance();

  hints: HintsType = [
    { label: '#', desc: 'tag', strategy: this.factory.getStrategy('tag') },
    { label: 'today', desc: i18n.today, strategy: this.factory.getStrategy('dateFilter') },
    { label: 'this week', desc: i18n.thisWeek, strategy: this.factory.getStrategy('dateFilter') },
    { label: 'this month', desc: i18n.thisMonth, strategy: this.factory.getStrategy('dateFilter') },
    { label: '>', desc: i18n.commands, strategy: this.factory.getStrategy('command') },
    { label: 'title:', desc: i18n.title, strategy: this.factory.getStrategy('title') },
    { label: 'task:', desc: 'task', strategy: this.factory.getStrategy('task') },
    { label: 'pdf', desc: 'PDF', strategy: this.factory.getStrategy('fileTypes') },
    { label: 'image', desc: i18n.images, strategy: this.factory.getStrategy('fileTypes') },
    { label: 'canvas', desc: 'canvas', strategy: this.factory.getStrategy('fileTypes') },
    { label: 'json', desc: 'json', strategy: this.factory.getStrategy('fileTypes') },
    { label: 'base', desc: 'base', strategy: this.factory.getStrategy('fileTypes') },
  ];

  constructor(app: App) {
    this.allFiles = app.vault.getFiles(); // Tutti i file, non solo markdown
    this.app = app;
    this.searchIndex = SearchIndex.getInstance(this.app);
  }

  renderHints(container: HTMLElement, onHintClick: (hint: string) => void): void {
    const hintBar = container.createDiv({ cls: 'hint-bar' });

    this.hints.forEach(hint => {
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

  async getResults(query: string): Promise<SearchResult[]> {
    console.log(query)
    const trimmedInput = query.trim();

    // Command mode: early return
    const commandResult = this.factory.getStrategy('command').extract(trimmedInput) as { isCommandMode: boolean; commandText?: string };

    if (commandResult.isCommandMode) {
      return this.getCommandSuggestions(commandResult.commandText || '');
    }

    // Strategie uniche matchate dagli hints (escluso command '>')
    const matchedStrategies = [...new Set(
      this.hints
        .filter(h => h.label !== '>' && trimmedInput.includes(h.label))
        .map(h => h.strategy)
    )];

    console.log('MATCHED STRATEGY')
    console.log(matchedStrategies)
    let results: TFile[] = this.allFiles;
    let remainingText = trimmedInput;
    let titleSearchDone = false;

    for (const strategy of matchedStrategies) {
      console.log('test')
      const extracted = strategy.extract(remainingText);

      remainingText = strategy.removeFrom(remainingText);

      if (isFilterable(strategy)) {
        results = strategy.filter(results, extracted, this.app);
        if ((extracted as any)?.scope === 'title') titleSearchDone = true;
      }
    }

    const freeText = remainingText.trim();

    if (!titleSearchDone && freeText) {
      const fileTypeLabels = ['pdf', 'image', 'canvas', 'json', 'base'];
      const isMarkdownOnly = !this.hints
        .filter(h => trimmedInput.includes(h.label))
        .some(h => fileTypeLabels.includes(h.label));

      if (this.searchIndex?.isIndexReady() && isMarkdownOnly) {
        const indexResults = this.searchIndex.search(freeText, 50);
        const resultPaths = new Set(results.map(f => f.path));

        results = indexResults.filter(f => resultPaths.has(f.path));
      } else {
        results = await this.searchIndex.searchFilesWithoutIndex(freeText, results);
      }
    } else if (!freeText && !titleSearchDone) {
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
