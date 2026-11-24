import { ResultData } from "../../engine/ResultData";
import { ModalItem } from "../Modal/ModalItem";
import { Body } from "../ui/Body";

export class ListCard {
  private item: ModalItem;
  private card: HTMLElement;
  private body: Body;

  constructor(parentEl: HTMLElement, body: Body) {
    this.card = parentEl.createDiv({ cls: 'finder-view-result' });
    this.item = new ModalItem(this.card);
    this.body = body;
  }

  public getElement(): HTMLElement {
    return this.card;
  }

  public render(data: ResultData): void {
    const { file, tags, searchedTags, typeIcon, taskInfo } = data;

    const title = this.item.setTitle(file.basename);

    if (typeIcon) {
      title.addTypeIcon(typeIcon);
    }

    this.item.setMetadata(
      new Date(file.stat.mtime).toLocaleDateString(),
      file.parent?.path || '/'
    );

    this.body.drawInItem(data, this.item);
    this.item.setTags(tags, searchedTags);

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
