import { App, Component } from "obsidian";
import { ResultData } from "../../engine/ResultData";
import { bodyText, MAX_TASK_LINES, Passage, TaskText } from "../../engine/occurrences";
import { ModalItem } from "../Modal/ModalItem";
import { ImagePreview } from "./ImagePreview";
import { VisibilityWatcher } from "./VisibilityWatcher";
import "./Body.css";

/** An Item clips its Occurrences to two lines; a Card shows them all and scrolls. */
type BodyLayout = 'item' | 'card';

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
    const textEl = hasText(data) ? item.setSnippet() : null;
    const previewEl = data.renderPreview ? item.setPreview() : null;

    this.drawWhenVisible(item.getElement(), data, 'item', textEl, previewEl, (emptyEl) => {
      emptyEl.remove();

      return item.setPreview();
    });
  }

  /** Every passage and every task line, scrolling inside the Card's fixed height; or the Preview. */
  public drawInCard(data: ResultData, cardEl: HTMLElement): void {
    const textEl = hasText(data) ? cardEl.createDiv({ cls: 'body-card-text' }) : null;
    const previewEl = data.renderPreview ? cardEl.createDiv({ cls: 'finder-view-preview' }) : null;

    this.drawWhenVisible(cardEl, data, 'card', textEl, previewEl, (emptyEl) => {
      const el = createDiv({ cls: 'finder-view-preview' });

      emptyEl.replaceWith(el);

      return el;
    });
  }

  private drawWhenVisible(
    watchedEl: HTMLElement,
    data: ResultData,
    layout: BodyLayout,
    textEl: HTMLElement | null,
    previewEl: HTMLElement | null,
    previewInsteadOf: (emptyEl: HTMLElement) => HTMLElement
  ): void {
    if (!textEl && !previewEl) return;

    this.visibility.watch(watchedEl, () => {
      if (textEl) this.drawTextOrPreview(data, textEl, layout, previewEl ? null : previewInsteadOf).catch(console.error);
      if (previewEl) this.drawPreview(data, previewEl).catch(console.error);
    });
  }

  /** A word found only in the title leaves no text to draw: the Body shows the Preview instead. */
  private async drawTextOrPreview(
    data: ResultData,
    textEl: HTMLElement,
    layout: BodyLayout,
    previewInsteadOf: ((emptyEl: HTMLElement) => HTMLElement) | null
  ): Promise<void> {
    const drawn = await this.drawText(data, textEl, layout);

    if (!drawn && previewInsteadOf && ImagePreview.hasPreview(this.app, data.file, { hasSnippet: false })) {
      await this.drawPreview(data, previewInsteadOf(textEl));
    }
  }

  private drawPreview(data: ResultData, el: HTMLElement): Promise<void> {
    return new ImagePreview(this.app, this.component).load(data.file, el);
  }

  /** False when the note holds none of the Occurrences or task lines the Data asked for. */
  private async drawText(data: ResultData, el: HTMLElement, layout: BodyLayout): Promise<boolean> {
    let content: string;

    try {
      content = await this.app.vault.cachedRead(data.file);
    } catch {
      // An unreadable file keeps its title and metadata: the result is still valid. No Preview
      // either, since it would read the same file.
      return true;
    }

    const { passages, tasks, hiddenTasks } = bodyText(content, data.snippetWords, data.taskLines, {
      // A Card scrolls, so it leaves no task line out.
      maxTasks: layout === 'card' ? Infinity : MAX_TASK_LINES,
    });

    if (passages.length > 0) {
      if (layout === 'card') {
        this.drawEveryPassage(el, passages);
      } else {
        this.drawPassages(el, passages);
      }
    }

    if (tasks.length > 0) {
      this.drawTasks(el, tasks, hiddenTasks);
    }

    return passages.length > 0 || tasks.length > 0;
  }

  /** The passages that fit in two lines, then the count of those left out. */
  private drawPassages(el: HTMLElement, passages: Passage[]): void {
    const occurrencesEl = el.createDiv({ cls: 'body-occurrences' });
    const box = occurrencesEl.createDiv({ cls: 'body-passages' });
    const passageEls = passages.map(passage => appendPassage(box.createSpan({ cls: 'body-passage' }), passage));
    // The box is the offset parent and clips at two lines: a passage starting below them is hidden.
    const hidden = passageEls.filter(passageEl => passageEl.offsetTop >= box.clientHeight).length;

    if (hidden > 0) {
      occurrencesEl.createSpan({ cls: 'body-more', text: `+${hidden}` });
    }
  }

  /** One passage per line: the Card scrolls, so none is left out. */
  private drawEveryPassage(el: HTMLElement, passages: Passage[]): void {
    const occurrencesEl = el.createDiv({ cls: 'body-card-occurrences' });

    for (const passage of passages) {
      appendPassage(occurrencesEl.createDiv({ cls: 'body-card-passage' }), passage);
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

function hasText(data: ResultData): boolean {
  return data.snippetWords.length > 0 || data.taskLines.length > 0;
}

function appendPassage(el: HTMLElement, passage: Passage): HTMLElement {
  if (passage.cutStart) el.appendText('… ');

  appendHighlighted(el, passage.text, passage.highlights);

  if (passage.cutEnd) el.appendText(' …');

  return el;
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
