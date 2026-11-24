import { App, TFile } from "obsidian";
import { QueryToken, SearchFilter, TaskStatus } from "./types";

/** A checkbox counts as done when Obsidian reports its status char as `x` or `X`. */
export function isDoneTask(task: string | undefined): boolean {
  return task === 'x' || task === 'X';
}

const STATUS_BY_KEY: Record<string, TaskStatus> = { task: 'all', 'task-todo': 'todo', 'task-done': 'done' };

// With several task keys in one query, todo wins over done and done over all.
const STATUS_RANK: Record<TaskStatus, number> = { all: 0, done: 1, todo: 2 };

/** `task:` takes no value: a word glued to it stays in the free text. */
export class TaskFilter extends SearchFilter<'taskFilter'> {
  readonly label = 'task:';
  readonly desc = 'task';
  readonly field = 'taskFilter';
  readonly keys = Object.keys(STATUS_BY_KEY);

  read(token: QueryToken, current: TaskStatus | undefined): TaskStatus {
    const status = STATUS_BY_KEY[token.key];

    return current && STATUS_RANK[current] > STATUS_RANK[status] ? current : status;
  }

  freeTextOf(token: QueryToken): string {
    return token.value;
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
        case 'todo': return tasks.some(t => !isDoneTask(t.task));
        case 'done': return tasks.some(t => isDoneTask(t.task));
        default: return true;
      }
    });
  }
}
