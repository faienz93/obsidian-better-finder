import { App, TFile, Command, Notice, EventRef } from "obsidian";
import { i18n } from "./const";
import { SearchStrategyFactory, ParsedQuery } from "./engine/SearchStrategy";
import { ModalItem } from "./component/Modal/ModalItem";
import { HintsType } from "./component/ui/HintBar";

export type SearchResult = TFile | Command;

/**
 * What one search settled on: the query it parsed, its results, and the words that made each file
 * match, keyed by path. Files found without free text have no entry.
 */
export interface SearchOutcome {
  parsed: ParsedQuery;
  results: SearchResult[];
  matchedWords: Map<string, string[]>;
}

export function isCommand(result: SearchResult): result is Command {
  return 'id' in result && 'name' in result;
}

export class Finder {
  allFiles: TFile[];
  private app: App;
  private factory = SearchStrategyFactory.getInstance();
  // The file list changes only on create/delete/rename: rebuilding it on every keystroke
  // froze large vaults, so it is cached and invalidated by those events.
  private filesDirty = false;
  private readonly vaultEventRefs: EventRef[] = [];

  readonly hints: HintsType[] = this.factory.hints;

  constructor(app: App) {
    this.app = app;
    this.allFiles = app.vault.getFiles(); // Every file, not only markdown

    const markDirty = () => { this.filesDirty = true; };

    this.vaultEventRefs.push(
      app.vault.on('create', markDirty),
      app.vault.on('delete', markDirty),
      app.vault.on('rename', markDirty),
    );
  }

  /** Releases the vault listeners. Call it when the owning Modal or Moodboard closes. */
  dispose(): void {
    for (const ref of this.vaultEventRefs) {
      this.app.vault.offref(ref);
    }

    this.vaultEventRefs.length = 0;
  }

  private getAllFiles(): TFile[] {
    if (this.filesDirty) {
      this.allFiles = this.app.vault.getFiles();
      this.filesDirty = false;
    }

    return this.allFiles;
  }

  getActiveHints(query: string): string[] {
    return this.factory.activeHints(query).map(h => h.label.toLowerCase());
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

  async getResults(query: string): Promise<SearchOutcome> {
    const parsed = this.factory.parse(query);

    // Command mode: early return
    if (parsed.isCommandMode) {
      return { parsed, results: this.getCommandSuggestions(parsed.commandText || ''), matchedWords: new Map() };
    }

    const filtered = this.factory.filter(this.getAllFiles(), parsed, this.app);
    const { files, matchedWords } = await this.factory.filterFreeText(filtered, parsed, this.app);

    return { parsed, results: this.dedupeByPath(files), matchedWords };
  }

  /** Drops duplicates, keeping the first one, which ranks highest. */
  private dedupeByPath(files: TFile[]): TFile[] {
    const seen = new Set<string>();

    return files.filter(file => {
      if (seen.has(file.path)) return false;

      seen.add(file.path);

      return true;
    });
  }

  renderCommand(command: Command, el: HTMLElement): void {
    const item = new ModalItem(el);
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

  /** Writes the current results to a markdown note (wikilinks plus metadata). */
  async exportResults(results: SearchResult[], query: string): Promise<void> {
    const files = results.filter((r): r is TFile => !isCommand(r));

    if (files.length === 0) {
      new Notice(i18n.exportEmpty);

      return;
    }

    const now = new Date();
    const lines = [
      `# ${i18n.exportTitle}`,
      '',
      `> ${i18n.exportQuery}: \`${query || '—'}\` — ${files.length} ${i18n.results} — ${now.toLocaleString()}`,
      '',
      ...files.map(f => `- [[${f.path}|${f.basename}]] — ${new Date(f.stat.mtime).toLocaleDateString()}`),
    ];
    const filename = `${i18n.exportTitle} ${now.toISOString().slice(0, 19).replace(/[T:]/g, '-')}.md`;

    try {
      const file = await this.app.vault.create(filename, lines.join('\n'));

      new Notice(`${i18n.exportDone}: ${file.basename}`);
      await this.app.workspace.getLeaf(false).openFile(file);
    } catch (error) {
      console.error('[Finder] Export failed:', error);
      new Notice(i18n.exportFailed);
    }
  }

  openResult(result: SearchResult): void {
    if (isCommand(result)) {
      (this.app as any).commands.executeCommandById(result.id);

      return;
    }

    // 'tab' always opens a new tab instead of replacing the current one.
    this.app.workspace.getLeaf('tab').openFile(result);
  }
}
