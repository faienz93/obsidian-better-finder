import { App, Component } from "obsidian";
import { ResultData } from "../../engine/ResultData";
import { ImagePreview } from "../ui/ImagePreview";
import { Metadata } from "../ui/Metadata";
import { Tags } from "../ui/Tags";
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

  public render(data: ResultData, app: App, component: Component): void {
    const { file, tags, searchedTags, taskInfo, renderPreview } = data;

    this.title = new Title(this.card, file.basename);

    if (file.extension !== 'md') {
      this.title.addBadge(` ${file.extension.toUpperCase()}`);
    }

    if (renderPreview) {
      const previewEl = this.card.createDiv({ cls: 'finder-view-preview' });

      new ImagePreview(app, component).load(file, previewEl);
    }

    const metadata = new Metadata(this.card);

    metadata.setContent(
      new Date(file.stat.mtime).toLocaleDateString(),
      file.parent?.path || '/'
    );

    if (tags.length > 0) {
      new Tags(this.card).setContent(tags, searchedTags);
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

  private renderTaskBadge(done: number, total: number): void {
    const badge = this.card.createDiv();

    badge.setCssStyles({ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' });
    badge.setText(`✓ ${done}/${total} tasks completed`);
  }
}
