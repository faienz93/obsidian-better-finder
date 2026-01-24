import { App, SuggestModal, TFile, getAllTags, TFolder } from "obsidian";
import { QueryParser, ParsedQuery } from "./QueryParser";

class FinderModal extends SuggestModal<TFile> {

  allFiles: TFile[];

  constructor(app: App) {
    super(app);
    this.allFiles = app.vault.getFiles(); // Tutti i file, non solo markdown
  }

  onOpen(): void {
    // Modal opened
  }

  // Returns all available suggestions based on parsed query
  getSuggestions(query: string): TFile[] {
    // Parse the query
    const parsed = QueryParser.parse(query);

    // If command mode, return empty (we'll handle commands separately later)
    if (parsed.isCommandMode) {
      // TODO: Show commands instead of files
      return [];
    }

    // Start with all files
    let results = this.allFiles;

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
      const searchText = parsed.freeText.toLowerCase();

      if (parsed.scope === 'title') {
        // Search only in file names
        results = results.filter(file =>
          file.basename.toLowerCase().includes(searchText)
        );
      } else {
        // Search in file names AND content
        results = results.filter(file => {
          // Check file name
          if (file.basename.toLowerCase().includes(searchText)) {
            return true;
          }

          // Check content (only for markdown files)
          if (file.extension === 'md') {
            const fileCache = this.app.metadataCache.getFileCache(file);
            if (fileCache) {
              // Search in headings
              if (fileCache.headings) {
                const headingMatch = fileCache.headings.some(h =>
                  h.heading.toLowerCase().includes(searchText)
                );
                if (headingMatch) return true;
              }

              // Search in sections (full content would require reading file)
              // For now we keep it simple
            }
          }

          return false;
        });
      }
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

  // Renders each suggestion item
  renderSuggestion(file: TFile, el: HTMLElement) {
    // Clear the element
    el.empty();

    // Parse query once at the beginning
    const parsed = QueryParser.parse(this.inputEl.value);

    // Container for the card
    const container = el.createDiv({ cls: 'suggestion-item' });

    // File name (title)
    const titleEl = container.createDiv({ cls: 'suggestion-title' });
    titleEl.createSpan({ text: file.basename });

    // File extension badge (if not markdown)
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

    // Metadata row (date + path)
    const metaRow = container.createDiv({ cls: 'suggestion-note' });
    metaRow.style.display = 'flex';
    metaRow.style.gap = '12px';
    metaRow.style.fontSize = '11px';
    metaRow.style.color = 'var(--text-muted)';
    metaRow.style.marginTop = '4px';

    // Date
    const dateEl = metaRow.createSpan();
    dateEl.setText(new Date(file.stat.mtime).toLocaleDateString());

    // Path
    const pathEl = metaRow.createSpan();
    pathEl.setText(file.parent?.path || '/');

    // Tags (only for markdown files)
    if (file.extension === 'md') {
      const fileCache = this.app.metadataCache.getFileCache(file);
      if (fileCache) {
        const fileTags = getAllTags(fileCache) || [];

        if (fileTags.length > 0) {
          const tagsContainer = container.createDiv();
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
            const taskBadge = container.createDiv();
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
  onChooseSuggestion(file: TFile) {
    const leaf = this.app.workspace.getLeaf(false);
    leaf.openFile(file);
  }
}

export default FinderModal;
