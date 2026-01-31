import { App, SuggestModal, TFile, getAllTags, TFolder, Command } from "obsidian";
import { QueryParser, ParsedQuery } from "./QueryParser";
import { SearchEngine } from "./SearchEngine";

type SearchResult = TFile | Command;

function isFile(result: SearchResult): result is TFile {
  return 'stat' in result;
}

function isCommand(result: SearchResult): result is Command {
  return 'id' in result && 'name' in result;
}

class FinderModal extends SuggestModal<SearchResult> {

  allFiles: TFile[];
  searchEngine: SearchEngine;

  constructor(app: App) {
    super(app);
    this.searchEngine = new SearchEngine(app);
    this.allFiles = app.vault.getFiles(); // Tutti i file, non solo markdown
  }

  onOpen(): void {
    this.renderHints();
  }

  private hintChips: Map<string, HTMLElement> = new Map();

  private renderHints(): void {
    // Find the input container to insert hints after it
    const promptEl = this.modalEl.querySelector('.prompt-input-container');
    if (!promptEl) return;

    // Create hint bar after the input
    const hintBar = createDiv({ cls: 'hint-bar' });
    promptEl.insertAdjacentElement('afterend', hintBar);

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
        this.inputEl.dispatchEvent(new Event('input'));
      });
    });

    // Listen for input changes to update hint highlighting
    this.inputEl.addEventListener('input', () => this.updateHintHighlights());
  }

  private updateHintHighlights(): void {
    const query = this.inputEl.value.toLowerCase();

    this.hintChips.forEach((chip, label) => {
      const isActive = query.includes(label) ||
        (label === '#tag' && !!query.match(/#\w+/)) ||
        (label === 'task:' && query.includes('task:'));

      chip.toggleClass('hint-chip-active', isActive);
    });
  }

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

  // Returns all available suggestions based on parsed query
  async getSuggestions(query: string): Promise<SearchResult[]> {
    // Parse the query
    const parsed = QueryParser.parse(query);

    // If command mode, return empty (we'll handle commands separately later)
    // COMMAND MODE: Show commands
    if (parsed.isCommandMode) {
      // TODO: Show commands instead of files
      return this.getCommandSuggestions(parsed.commandText || '');
    }

    // Start with all files
    let results: TFile[] = this.allFiles;

    // 1. Filter by file types (if specified)
    if (parsed.fileTypes.length > 0) {
      results = results.filter(file =>
        parsed.fileTypes.some(ext => file.extension === ext.slice(1)) // Remove the dot
      );
    } else {
      // If no file type specified, default to markdown files only
      results = results.filter(file => file.extension === 'md');
    }

    // 2. Filter by tags (if specified)
    if (parsed.tags.length > 0) {
      results = results.filter(file => {
        const fileCache = this.app.metadataCache.getFileCache(file);
        if (!fileCache) return false;

        const fileTags = getAllTags(fileCache) || [];
        // All tags must be present
        return parsed.tags.every(tag => fileTags.includes(tag));
      });
    }

    // 3. Filter by date (if specified)
    if (parsed.dateFilter) {
      results = results.filter(file => {
        const fileDate = new Date(file.stat.mtime); // Modified time

        switch (parsed.dateFilter) {
          case 'today':
            return QueryParser.isToday(fileDate);
          case 'this-week':
            return QueryParser.isThisWeek(fileDate);
          case 'this-month':
            return QueryParser.isThisMonth(fileDate);
          default:
            return true;
        }
      });
    }

    // 4. Filter by scope (title or content)
    if (parsed.freeText) {
      if (parsed.scope === 'title') {
        // Search only in titles
        results = this.searchEngine.searchInTitles(parsed.freeText, results);
      } else {
        // Search in content (async)
        results = await this.searchEngine.searchFiles(parsed, results);
      }
    } else {
      // No free text search, just sort by date
      results.sort((a, b) => b.stat.mtime - a.stat.mtime);
    }

    // 5. Filter by tasks (if specified)
    if (parsed.taskFilter) {
      results = results.filter(file => {
        if (file.extension !== 'md') return false;

        const fileCache = this.app.metadataCache.getFileCache(file);
        if (!fileCache || !fileCache.listItems) return false;

        const tasks = fileCache.listItems.filter(item => item.task);
        if (tasks.length === 0) return false;

        switch (parsed.taskFilter) {
          case 'all':
            return true; // Has tasks
          case 'todo':
            return tasks.some(t => t.task !== 'x' && t.task !== 'X');
          case 'done':
            return tasks.some(t => t.task === 'x' || t.task === 'X');
          default:
            return true;
        }
      });
    }

    // Sort results by modification time (most recent first)
    results.sort((a, b) => b.stat.mtime - a.stat.mtime);

    return results;
  }


  private renderCommand(command: Command, el: HTMLElement) {
    el.addClass('suggestion-item');

    // Command name
    const titleEl = el.createDiv({ cls: 'suggestion-title' });
    titleEl.createSpan({ text: command.name });

    // Command icon (if exists)
    if (command.icon) {
      const iconEl = titleEl.createSpan({ cls: 'suggestion-flair' });
      iconEl.style.marginLeft = '8px';
      iconEl.setText(command.icon);
    }

    // Command ID
    const metaRow = el.createDiv({ cls: 'suggestion-note' });
    metaRow.style.fontSize = '11px';
    metaRow.style.color = 'var(--text-muted)';
    metaRow.style.marginTop = '4px';
    metaRow.setText(command.id);

    // Hotkey (if exists)
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

  // Renders each suggestion item
  renderSuggestion(result: SearchResult, el: HTMLElement) {
    // Clear the element
    el.empty();

    if (isCommand(result)) {
      this.renderCommand(result, el);
      return;
    }

    // RENDER FILE (existing code)
    const file = result as TFile;

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
          const todoCount = tasks.filter(t => t.task !== 'x' && t.task !== 'X').length;
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

  // Perform action on the selected suggestion
  onChooseSuggestion(result: SearchResult) {
    // Execute command
    if (isCommand(result)) {
      (this.app as any).commands.executeCommandById(result.id);
      return;
    }

    // Open file (existing logic)
    const file = result as TFile;
    const leaf = this.app.workspace.getLeaf(false);
    leaf.openFile(file);
  }
}

export default FinderModal;
