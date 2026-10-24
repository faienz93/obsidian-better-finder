import { App, Component } from "obsidian";
import { ResultData } from "../../engine/ResultData";
import { bodyText, Passage, TaskText } from "../../engine/occurrences";
import { ModalItem } from "../Modal/ModalItem";
import { ImagePreview } from "./ImagePreview";
import { VisibilityWatcher } from "./VisibilityWatcher";
import "./Body.css";

/**
 * Draws what the Data chose for a result below its title: Occurrences, task lines, Preview or
 * nothing. The file is read only once the result becomes visible.
 */
export class Body {
  private visibility = new VisibilityWatcher();

  constructor(private app: App, private component: Component) {}

  /** Forgets the results drawn so far: call it before drawing a new set of results, and on close. */
  public reset(): void {
    this.visibility.reset();
  }

  /** Occurrences and task lines under the metadata, the Preview beside the text. */
  public drawInItem(data: ResultData, item: ModalItem): void {
    const { file, snippetWords, taskLines, renderPreview } = data;
    const textEl = snippetWords.length > 0 || taskLines.length > 0 ? item.setSnippet() : null;
    const previewEl = renderPreview ? item.setPreview() : null;

    if (!textEl && !previewEl) return;

    this.visibility.watch(item.getElement(), () => {
      if (textEl) this.drawText(data, textEl).catch(console.error);
      if (previewEl) new ImagePreview(this.app, this.component).load(file, previewEl).catch(console.error);
    });
  }

  private async drawText(data: ResultData, el: HTMLElement): Promise<void> {
    let content: string;

    try {
      content = await this.app.vault.cachedRead(data.file);
    } catch {
      // An unreadable file keeps its title and metadata: the result is still valid.
      return;
    }

    const { passages, tasks, hiddenTasks } = bodyText(content, data.snippetWords, data.taskLines);

    if (passages.length > 0) {
      this.drawPassages(el, passages);
    }

    if (tasks.length > 0) {
      this.drawTasks(el, tasks, hiddenTasks);
    }
  }

  /** The passages that fit in two lines, then the count of those left out. */
  private drawPassages(el: HTMLElement, passages: Passage[]): void {
    const occurrencesEl = el.createDiv({ cls: 'body-occurrences' });
    const box = occurrencesEl.createDiv({ cls: 'body-passages' });
    const passageEls = passages.map((passage) => {
      const passageEl = box.createSpan({ cls: 'body-passage' });

      if (passage.cutStart) passageEl.appendText('… ');

      appendHighlighted(passageEl, passage.text, passage.highlights);

      if (passage.cutEnd) passageEl.appendText(' …');

      return passageEl;
    });
    // The box is the offset parent and clips at two lines: a passage starting below them is hidden.
    const hidden = passageEls.filter(passageEl => passageEl.offsetTop >= box.clientHeight).length;

    if (hidden > 0) {
      occurrencesEl.createSpan({ cls: 'body-more', text: `+${hidden}` });
    }
  }

  private drawTasks(el: HTMLElement, tasks: TaskText[], hiddenTasks: number): void {
    const tasksEl = el.createDiv({ cls: 'task-snippet' });

    for (const task of tasks) {
      const taskEl = tasksEl.createDiv({ cls: 'task-snippet-item' });

      taskEl.createSpan({ cls: 'task-snippet-check', text: task.done ? '☑' : '☐' });
      appendHighlighted(taskEl.createSpan({ cls: 'task-snippet-text' }), task.text, task.highlights);
    }

    if (hiddenTasks > 0) {
      tasksEl.createDiv({ cls: 'task-snippet-more', text: `+${hiddenTasks}` });
    }
  }
}

function appendHighlighted(el: HTMLElement, text: string, highlights: Array<[number, number]>): void {
  let pos = 0;

  for (const [start, end] of highlights) {
    el.appendText(text.slice(pos, start));
    el.createEl('mark', { cls: 'snippet-highlight', text: text.slice(start, end) });
    pos = end;
  }

  el.appendText(text.slice(pos));
}
