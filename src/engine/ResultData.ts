import { App, TFile } from "obsidian";
import { SearchOutcome } from "../Finder";
import { ImagePreview } from "../component/ui/ImagePreview";
import { getFileTags } from "./fileTags";
import { isDoneTask } from "./search-filters/TaskFilter";
import { matchesTag } from "./search-filters/TagsFilter";
import { TaskStatus } from "./search-filters/types";

/** What one result shows, decided once from the file and the whole query. */
export interface ResultData {
  file: TFile;
  tags: string[];
  /** The tags of `tags` the query asked for, nested ones included. */
  searchedTags: string[];
  taskInfo?: {
    done: number;
    total: number;
  };
  renderPreview?: boolean;
  /** Free text whose Occurrences the Body highlights. */
  snippetTerm?: string;
  /** With a task filter: show the text of the tasks in this state. */
  taskSnippet?: TaskStatus;
}

/** Reads only cached metadata and the canvas tag common cache, never file contents. */
export function buildResultData(app: App, file: TFile, outcome: SearchOutcome): ResultData {
  const { parsed } = outcome;
  const tags = getFileTags(file, app);
  const searchedTags = tags.filter(tag => parsed.tags.some(queryTag => matchesTag(tag, queryTag)));
  const isNote = file.extension.toLowerCase() === 'md';
  const snippetTerm = isNote && parsed.freeText ? parsed.freeText : undefined;
  const taskSnippet = isNote ? parsed.taskFilter : undefined;

  return {
    file,
    tags,
    searchedTags,
    taskInfo: parsed.taskFilter ? countTasks(app, file) : undefined,
    renderPreview: ImagePreview.hasPreview(app, file, { hasSnippet: !!(snippetTerm || taskSnippet) }),
    snippetTerm,
    taskSnippet,
  };
}

function countTasks(app: App, file: TFile): { done: number; total: number } {
  const tasks = app.metadataCache.getFileCache(file)?.listItems?.filter(i => i.task) || [];

  return { done: tasks.filter(t => isDoneTask(t.task)).length, total: tasks.length };
}
