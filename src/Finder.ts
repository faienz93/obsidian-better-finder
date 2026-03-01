import { App, TFile, Command } from "obsidian";
import { SearchStrategyFactory } from "./engine/SearchStrategy";
import { i18n } from "./const";
import { SuggestionItem } from "./component/Card";
import { HintsType } from "./component/ui/HintBar";

export type SearchResult = TFile | Command;

// TODO non usato. NON CANCELLARE
export function isFile(result: SearchResult): result is TFile {
  return 'stat' in result;
}

export function isCommand(result: SearchResult): result is Command {
  return 'id' in result && 'name' in result;
}

export class Finder {
  allFiles: TFile[];
  lastResultCount = 0;
  private app: App;
  private debounceTimer: number | null = null;
  private static readonly DEBOUNCE_MS = 150;
  private factory = SearchStrategyFactory.getInstance();

  readonly hints: HintsType[] = [
    { label: '#', desc: 'tag' },
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

  constructor(app: App) {
    this.allFiles = app.vault.getFiles(); // Tutti i file, non solo markdown
    this.app = app;
  }

  getActiveHints(query: string): string[] {
    const q = query.toLowerCase();

    return this.hints
      .map(h => h.label.toLowerCase())
      .filter(label => q.includes(label));
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
    const parsed = this.factory.parse(query);

    // Command mode: early return
    if (parsed.isCommandMode) {
      return this.getCommandSuggestions(parsed.commandText || '');
    }

    // Apply all filters
    let results = this.factory.filter(this.allFiles, parsed, this.app);

    results = await this.factory.filterFreeText(results, parsed, this.app);

    return results.slice(0, 50);
  }

  renderCommand(command: Command, el: HTMLElement): void {
    const item = new SuggestionItem(el);
    const title = item.setTitle(command.name);

    if (command.icon) {
      item.setBadge(title, command.icon);
    }

    item.setNote(command.id);

    const hotkeys = (this.app as any).hotkeyManager.getHotkeys(command.id);

    if (hotkeys && hotkeys.length > 0) {
      const hotkeyText = hotkeys.map((hk: any) => {
        const modifiers = [];

        if (hk.modifiers.includes('Mod')) modifiers.push('Ctrl');
        if (hk.modifiers.includes('Shift')) modifiers.push('Shift');
        if (hk.modifiers.includes('Alt')) modifiers.push('Alt');

        return [...modifiers, hk.key].join('+');
      }).join(', ');

      item.setHotkey(hotkeyText);
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
      }, Finder.DEBOUNCE_MS);
    });
  }

  openResult(result: SearchResult): void {
    if (isCommand(result)) {
      (this.app as any).commands.executeCommandById(result.id);

      return;
    }

    const file = result as TFile;

    this.app.workspace.getLeaf(false).openFile(file);
  }
}
