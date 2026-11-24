import { App, ListItemCache, TFile } from "obsidian";
import { SearchOutcome } from "../Finder";
import { ImagePreview } from "../component/ui/ImagePreview";
import { getFileTags } from "./fileTags";
import { isNote } from "./excalidraw";
import { fileTypeIcon, FileTypeIcon } from "./fileTypeIcon";
import { isDoneTask } from "./search-filters/TaskFilter";
import { matchesTag } from "./search-filters/TagsFilter";
import { HighlightCriterion, TaskStatus } from "./search-filters/types";

/** What one result shows, decided once from the file and the whole query. */
export interface ResultData {
  file: TFile;
  tags: string[];
  /** The tags of `tags` the query asked for, nested ones included. */
  searchedTags: string[];
  /** Undefined for a note; every other file type, Excalidraw drawings included, shows an icon next to the title. */
  typeIcon?: FileTypeIcon;
  taskInfo?: {
    done: number;
    total: number;
  };
  renderPreview?: boolean;
  /** Words whose Occurrences the Body shows: the ones the search matched. Empty for no Occurrences. */
  snippetWords: string[];
  /** With a task filter: the lines of the tasks it asked for, which the Body shows. */
  taskLines: TaskLine[];
  /** With the highlight filter, for a note: which of its Highlights the Body shows. */
  highlightCriterion?: HighlightCriterion;
  /** A Card showing Occurrences or Highlights offers a button that switches its Body to the Preview and back. */
  offersPreview: boolean;
}

export interface TaskLine {
  /** Zero-based line of the note. */
  line: number;
  done: boolean;
}

/** Reads only cached metadata and the canvas tag common cache, never file contents. */
export function buildResultData(app: App, file: TFile, outcome: SearchOutcome): ResultData {
  const { parsed } = outcome;
  const tags = getFileTags(file, app);
  const searchedTags = tags.filter(tag => parsed.tags.some(queryTag => matchesTag(tag, queryTag)));
  // A drawing's text is its encoded scene: it shows its Preview, never Occurrences.
  const snippetWords = isNote(app, file) ? outcome.matchedWords.get(file.path) ?? [] : [];
  const tasks = parsed.taskFilter ? tasksOf(app, file) : [];
  const taskLines = isNote(app, file) && parsed.taskFilter ? pickTaskLines(tasks, parsed.taskFilter) : [];
  const highlightCriterion = isNote(app, file) ? parsed.highlightFilter : undefined;
  const showsOccurrencesOrHighlights = snippetWords.length > 0 || highlightCriterion !== undefined;

  return {
    file,
    tags,
    searchedTags,
    typeIcon: fileTypeIcon(app, file),
    taskInfo: parsed.taskFilter ? countTasks(tasks) : undefined,
    renderPreview: ImagePreview.hasPreview(app, file, { hasSnippet: showsOccurrencesOrHighlights || taskLines.length > 0 }),
    snippetWords,
    taskLines,
    highlightCriterion,
    offersPreview: showsOccurrencesOrHighlights && ImagePreview.hasPreview(app, file, { hasSnippet: false }),
  };
}

function tasksOf(app: App, file: TFile): ListItemCache[] {
  return app.metadataCache.getFileCache(file)?.listItems?.filter(i => i.task) || [];
}

function countTasks(tasks: ListItemCache[]): { done: number; total: number } {
  return { done: tasks.filter(t => isDoneTask(t.task)).length, total: tasks.length };
}

function pickTaskLines(tasks: ListItemCache[], status: TaskStatus): TaskLine[] {
  return tasks
    .map(task => ({ line: task.position.start.line, done: isDoneTask(task.task) }))
    .filter(task => status === 'all' || task.done === (status === 'done'));
}
