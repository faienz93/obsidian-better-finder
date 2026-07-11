import { App, TFile } from "obsidian";
import { TaskStatus } from "../../engine/search-filters/types";
import "./TaskSnippet.css";

const MAX_TASKS_SHOWN = 3;

/**
 * Mostra il testo dei task del file (filtrati per stato) dentro il risultato,
 * con lo stesso trattamento visivo delle voci evidenziate.
 */
export class TaskSnippet {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  public async load(file: TFile, status: TaskStatus, el: HTMLElement): Promise<void> {
    const cache = this.app.metadataCache.getFileCache(file);
    const items = (cache?.listItems ?? []).filter(i => i.task !== undefined);
    const isDone = (task: string | undefined) => task === 'x' || task === 'X';
    const wanted = items.filter(i => {
      if (status === 'todo') return !isDone(i.task);
      if (status === 'done') return isDone(i.task);

      return true;
    });

    if (wanted.length === 0) return;

    try {
      const content = await this.app.vault.cachedRead(file);
      const lines = content.split('\n');

      el.addClass('task-snippet');

      for (const item of wanted.slice(0, MAX_TASKS_SHOWN)) {
        const line = lines[item.position.start.line] ?? '';
        // Toglie marcatore lista e checkbox: resta solo il testo del task
        const text = line.replace(/^\s*(?:[-*+]|\d+\.)\s*\[.\]\s*/, '').trim();

        if (!text) continue;

        const row = el.createDiv({ cls: 'task-snippet-item' });

        row.createSpan({ cls: 'task-snippet-check', text: isDone(item.task) ? '☑' : '☐' });
        row.createSpan({ cls: 'task-snippet-text', text });
      }

      if (wanted.length > MAX_TASKS_SHOWN) {
        el.createDiv({ cls: 'task-snippet-more', text: `+${wanted.length - MAX_TASKS_SHOWN}` });
      }
    } catch {
      // File non leggibile: nessuno snippet
    }
  }
}
