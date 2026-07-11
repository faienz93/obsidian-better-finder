import { App, Component } from "obsidian";
import { Card } from "../interface/Card";
import { ModalItem } from "../Modal/ModalItem";
import { ImagePreview } from "../ui/ImagePreview";
import { Title } from "../ui/Title";

export class ListCard {
  private item: ModalItem;
  private card: HTMLElement;
  private title!: Title;

  constructor(parentEl: HTMLElement) {
    this.card = parentEl.createDiv({ cls: 'finder-view-result' });
    this.item = new ModalItem(this.card);
  }

  public getElement(): HTMLElement {
    return this.card;
  }

  public render(data: Card, app: App, component: Component): void {
    const { file, tags, searchedTags, taskInfo } = data;

    this.title = this.item.setTitle(file.basename);

    if (file.extension !== 'md') {
      this.item.setBadge(this.title, ` ${file.extension.toUpperCase()}`);
    }

    this.item.setMetadata(
      new Date(file.stat.mtime).toLocaleDateString(),
      file.parent?.path || '/'
    );

    this.item.setPreview((previewEl) => {
      new ImagePreview(app, component).load(file, previewEl);
    });

    if (file.extension !== 'md') return;

    if (tags.length > 0) {
      this.item.setTags(tags, searchedTags);
    }

    if (taskInfo && taskInfo.total > 0) {
      this.item.setTaskBadge(taskInfo.done, taskInfo.total);
    }
  }

  public onClick(fn: (event: MouseEvent) => void): void {
    this.card.addEventListener('click', (event) => fn(event));
  }

  public onContextMenu(fn: (event: MouseEvent) => void): void {
    this.card.addEventListener('contextmenu', (event) => fn(event));
  }
}
