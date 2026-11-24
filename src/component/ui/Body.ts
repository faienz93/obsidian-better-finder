import { App, Component, setIcon } from "obsidian";
import { i18n } from "../../const";
import { ResultData } from "../../engine/ResultData";
import { bodyText, HighlightPassage, MAX_HIGHLIGHTS, MAX_TASK_LINES, Passage, TaskText } from "../../engine/occurrences";
import { ModalItem } from "../Modal/ModalItem";
import { ImagePreview } from "./ImagePreview";
import { VisibilityWatcher } from "./VisibilityWatcher";
import "./Body.css";

/** An Item clips its Occurrences to two lines; a Card shows them all and scrolls. */
type BodyLayout = 'item' | 'card';

/**
 * Draws what the Data chose for a result below its title: Highlights, task lines, Occurrences,
 * Preview or nothing. The file is read only once the result becomes visible.
 */
export class Body {
  private visibility = new VisibilityWatcher();

  constructor(private app: App, private component: Component) {}

  /** Forgets the results drawn so far: call it before drawing a new set of results, and on close. */
  public reset(): void {
    this.visibility.reset();
  }

  /** Highlights, task lines and Occurrences under the metadata, the Preview beside the text. */
  public drawInItem(data: ResultData, item: ModalItem): void {
    const textEl = hasText(data) ? item.setSnippet() : null;
    const previewEl = data.renderPreview ? item.setPreview() : null;

    this.drawWhenVisible(item.getElement(), data, 'item', textEl, previewEl, (emptyEl) => {
      emptyEl.remove();

      return item.setPreview();
    });
  }

  /**
   * Every Highlight, task line and passage, scrolling inside the Card's fixed height; or the Preview.
   * Drawn Highlights or Occurrences get the button that switches to the Preview when the Data offers it.
   */
  public drawInCard(data: ResultData, cardEl: HTMLElement): void {
    const textEl = hasText(data) ? cardEl.createDiv({ cls: 'body-card-text' }) : null;
    const previewEl = data.renderPreview ? cardEl.createDiv({ cls: 'finder-view-preview' }) : null;
    const onOccurrencesOrHighlightsDrawn = textEl && data.offersPreview ? () => this.addPreviewToggle(data, cardEl, textEl) : undefined;

    this.drawWhenVisible(cardEl, data, 'card', textEl, previewEl, (emptyEl) => {
      const el = createDiv({ cls: 'finder-view-preview' });

      emptyEl.replaceWith(el);

      return el;
    }, onOccurrencesOrHighlightsDrawn);
  }

  /** The Preview is drawn on the first click and kept; the Card is rebuilt, so reset, by the next search. */
  private addPreviewToggle(data: ResultData, cardEl: HTMLElement, textEl: HTMLElement): void {
    const button = cardEl.createDiv({ cls: 'clickable-icon body-preview-toggle' });
    let previewEl: HTMLElement | null = null;
    let showingPreview = false;

    const showPreview = (preview: boolean) => {
      showingPreview = preview;
      textEl.toggle(!preview);
      previewEl?.toggle(preview);
      setIcon(button, preview ? 'eye-off' : 'eye');
      button.setAttribute('aria-label', preview ? i18n.showOccurrences : i18n.showPreview);
    };

    cardEl.addClass('has-preview-toggle');
    showPreview(false);

    button.addEventListener('click', (event) => {
      // The Card opens its file on click.
      event.stopPropagation();

      if (!previewEl) {
        previewEl = createDiv({ cls: 'finder-view-preview' });
        textEl.after(previewEl);
        this.drawPreview(data, previewEl).catch(console.error);
      }

      showPreview(!showingPreview);
    });
  }

  private drawWhenVisible(
    watchedEl: HTMLElement,
    data: ResultData,
    layout: BodyLayout,
    textEl: HTMLElement | null,
    previewEl: HTMLElement | null,
    previewInsteadOf: (emptyEl: HTMLElement) => HTMLElement,
    onOccurrencesOrHighlightsDrawn?: () => void
  ): void {
    if (!textEl && !previewEl) return;

    this.visibility.watch(watchedEl, () => {
      if (textEl) {
        this.drawTextOrPreview(data, textEl, layout, previewEl ? null : previewInsteadOf, onOccurrencesOrHighlightsDrawn).catch(console.error);
      }

      if (previewEl) this.drawPreview(data, previewEl).catch(console.error);
    });
  }

  /** A word found only in the title leaves no text to draw: the Body shows the Preview instead. */
  private async drawTextOrPreview(
    data: ResultData,
    textEl: HTMLElement,
    layout: BodyLayout,
    previewInsteadOf: ((emptyEl: HTMLElement) => HTMLElement) | null,
    onOccurrencesOrHighlightsDrawn?: () => void
  ): Promise<void> {
    const { drawn, occurrencesOrHighlights } = await this.drawText(data, textEl, layout);

    if (occurrencesOrHighlights) onOccurrencesOrHighlightsDrawn?.();

    if (!drawn && previewInsteadOf && ImagePreview.hasPreview(this.app, data.file, { hasSnippet: false })) {
      await this.drawPreview(data, previewInsteadOf(textEl));
    }
  }

  private drawPreview(data: ResultData, el: HTMLElement): Promise<void> {
    return new ImagePreview(this.app, this.component).load(data.file, el);
  }

  /**
   * `drawn` is false when the note holds none of the Highlights, task lines or Occurrences the Data
   * asked for; `occurrencesOrHighlights` is true when Highlights or Occurrences were drawn.
   */
  private async drawText(
    data: ResultData,
    el: HTMLElement,
    layout: BodyLayout
  ): Promise<{ drawn: boolean; occurrencesOrHighlights: boolean }> {
    let content: string;

    try {
      content = await this.app.vault.cachedRead(data.file);
    } catch {
      // An unreadable file keeps its title and metadata: the result is still valid. No Preview
      // either, since it would read the same file.
      return { drawn: true, occurrencesOrHighlights: false };
    }

    // A Card scrolls, so it leaves no Highlight or task line out.
    const scrolls = layout === 'card';
    const { highlights, hiddenHighlights, passages, tasks, hiddenTasks } = bodyText(
      content,
      data.snippetWords,
      data.taskLines,
      data.highlightCriterion,
      { maxTasks: scrolls ? Infinity : MAX_TASK_LINES, maxHighlights: scrolls ? Infinity : MAX_HIGHLIGHTS }
    );

    if (highlights.length > 0) {
      this.drawHighlights(el, highlights, hiddenHighlights);
    }

    if (tasks.length > 0) {
      this.drawTasks(el, tasks, hiddenTasks);
    }

    if (passages.length > 0) {
      if (layout === 'card') {
        this.drawEveryPassage(el, passages);
      } else {
        this.drawPassages(el, passages);
      }
    }

    const occurrencesOrHighlights = highlights.length > 0 || passages.length > 0;

    return { drawn: occurrencesOrHighlights || tasks.length > 0, occurrencesOrHighlights };
  }

  /** One Highlight passage per line, then the count of those left out. */
  private drawHighlights(el: HTMLElement, highlights: HighlightPassage[], hiddenHighlights: number): void {
    const highlightsEl = el.createDiv({ cls: 'body-highlights' });

    for (const passage of highlights) {
      appendHighlightPassage(highlightsEl.createDiv({ cls: 'body-highlight' }), passage);
    }

    if (hiddenHighlights > 0) {
      highlightsEl.createDiv({ cls: 'body-highlights-more', text: `+${hiddenHighlights}` });
    }
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
  return data.snippetWords.length > 0 || data.taskLines.length > 0 || data.highlightCriterion !== undefined;
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

/**
 * Each Highlight is marked in its Obsidian colour; one without a colour in the accent colour, like a
 * searched word. The searched words are marked as in an Occurrence, inside a Highlight too.
 */
function appendHighlightPassage(el: HTMLElement, passage: HighlightPassage): void {
  const appendText = (parentEl: HTMLElement, from: number, to: number) => {
    const occurrences = passage.occurrences
      .filter(([start, end]) => start < to && end > from)
      .map(([start, end]): [number, number] => [Math.max(start, from) - from, Math.min(end, to) - from]);

    appendHighlighted(parentEl, passage.text.slice(from, to), occurrences);
  };

  let pos = 0;

  if (passage.cutStart) el.appendText('… ');

  for (const highlight of passage.highlights) {
    appendText(el, pos, highlight.start);
    appendText(el.createEl('mark', {
      cls: ['snippet-highlight', 'body-highlight-text'],
      attr: highlight.colour ? { 'data-highlight': highlight.colour } : {},
    }), highlight.start, highlight.end);
    pos = highlight.end;
  }

  appendText(el, pos, passage.text.length);

  if (passage.cutEnd) el.appendText(' …');
}
