import { ResultData } from "../../engine/ResultData";
import { Body } from "../ui/Body";
import { Metadata } from "../ui/Metadata";
import { Tags } from "../ui/Tags";
import { Title } from "../ui/Title";

export class GridCard {
  private card: HTMLElement;
  private title!: Title;
  private body: Body;

  constructor(parentEl: HTMLElement, body: Body) {
    this.card = parentEl.createDiv({ cls: 'finder-view-result suggestion-item' });
    this.body = body;
  }

  public getElement(): HTMLElement {
    return this.card;
  }

  public render(data: ResultData): void {
    const { file, tags, searchedTags, taskInfo } = data;

    this.title = new Title(this.card, file.basename);

    if (file.extension !== 'md') {
      this.title.addBadge(` ${file.extension.toUpperCase()}`);
    }

    this.body.drawInCard(data, this.card);

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
