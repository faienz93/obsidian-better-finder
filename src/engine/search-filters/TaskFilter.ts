import { App, TFile } from "obsidian";
import { SearchFilter, TaskStatus } from "./types";

export class TaskFilter extends SearchFilter<TaskStatus | undefined> {
  readonly label = 'task:';
  readonly desc = 'task';

  extract(query: string): TaskStatus | undefined {
    const lowerQuery = query.toLowerCase();

    // NB: niente \b finale — dopo ":" non c'è confine di parola se il token è
    // seguito da spazio o fine stringa (il click sull'hint produce "task: "): bug B4.
    if (/\btask-todo:/.test(lowerQuery)) return 'todo';
    if (/\btask-done:/.test(lowerQuery)) return 'done';
    if (/\btask:/.test(lowerQuery)) return 'all';

    return undefined;
  }

  removeFrom(query: string): string {
    return query
      .replace(/\btask-todo:/gi, '')
      .replace(/\btask-done:/gi, '')
      .replace(/\btask:/gi, '')
      .trim();
  }

  filter(files: TFile[], taskFilter: TaskStatus | undefined, app: App): TFile[] {
    if (!taskFilter) return files;

    return files.filter(file => {
      if (file.extension !== 'md') return false;
      const cache = app.metadataCache.getFileCache(file);

      if (!cache?.listItems) return false;
      const tasks = cache.listItems.filter(item => item.task);

      if (tasks.length === 0) return false;

      switch (taskFilter) {
        case 'all': return true;
        case 'todo': return tasks.some(t => t.task !== 'x' && t.task !== 'X');
        case 'done': return tasks.some(t => t.task === 'x' || t.task === 'X');
        default: return true;
      }
    });
  }
}
