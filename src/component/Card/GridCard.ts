import { App, Component } from "obsidian";
import { Card } from "../interface/Card";
import { ImagePreview } from "../ui/ImagePreview";
import { Metadata } from "../ui/Metadata";
import { Title } from "../ui/Title";

export class GridCard {
  private card: HTMLElement;
  private title!: Title;

  constructor(parentEl: HTMLElement) {
    this.card = parentEl.createDiv({ cls: 'finder-view-result suggestion-item' });
  }

  public getElement(): HTMLElement {
    return this.card;
  }

  public render(data: Card, app: App, component: Component): void {
    const { file, tags, searchedTags, taskInfo } = data;

    this.title = new Title(this.card, file.basename);

    if (file.extension !== 'md') {
      this.title.addBadge(` ${file.extension.toUpperCase()}`);
    }

    const previewEl = this.card.createDiv({ cls: 'finder-view-preview' });

    new ImagePreview(app, component).load(file, previewEl);

    const metadata = new Metadata(this.card);

    metadata.setContent(
      new Date(file.stat.mtime).toLocaleDateString(),
      file.parent?.path || '/'
    );

    if (file.extension !== 'md') return;

    if (tags.length > 0) {
      this.renderTags(tags, searchedTags);
    }

    if (taskInfo && taskInfo.total > 0) {
      this.renderTaskBadge(taskInfo.done, taskInfo.total);
    }
  }

  public onClick(fn: (event: MouseEvent) => void): void {
    this.card.addEventListener('click', (event) => fn(event));
  }

  public onContextMenu(fn: (event: MouseEvent) => void): void {
    this.card.addEventListener('contextmenu', (event) => fn(event));
  }

  private renderTags(tags: string[], searchedTags: string[]): void {
    const container = this.card.createDiv();

    container.setCssStyles({ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' });
    tags.forEach(tag => {
      const tagEl = container.createSpan({ text: tag });
      const isMatched = searchedTags.some(st => tag.toLowerCase() === st.toLowerCase());

      tagEl.setCssStyles({
        background: isMatched ? 'var(--interactive-accent)' : 'var(--tag-background)',
        color: isMatched ? 'var(--text-on-accent)' : 'var(--tag-color)',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: isMatched ? '600' : 'normal',
      });
    });
  }

  private renderTaskBadge(done: number, total: number): void {
    const badge = this.card.createDiv();

    badge.setCssStyles({ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' });
    badge.setText(`✓ ${done}/${total} tasks completed`);
  }
}
