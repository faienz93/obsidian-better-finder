import { App, TFile } from "obsidian";
import { SearchFilter, TaskStatus } from "./types";

export class TaskFilter extends SearchFilter<TaskStatus | undefined> {
  readonly label = 'task:';
  readonly desc = 'task';

  extract(query: string): TaskStatus | undefined {
    const lowerQuery = query.toLowerCase();

    if (/\btask-todo:\b/.test(lowerQuery)) return 'todo';
    if (/\btask-done:\b/.test(lowerQuery)) return 'done';
    if (/\btask:\b/.test(lowerQuery)) return 'all';

    return undefined;
  }

  removeFrom(query: string): string {
    return query
      .replace(/\btask-todo:\b/gi, '')
      .replace(/\btask-done:\b/gi, '')
      .replace(/\btask:\b/gi, '')
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
