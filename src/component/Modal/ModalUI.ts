import { ResultData } from "../../engine/ResultData";
import { Body } from "../ui/Body";
import { ModalItem } from "./ModalItem";

export class ModalUI {
  private item: ModalItem;
  private body: Body;

  constructor(el: HTMLElement, body: Body) {
    this.body = body;
    this.item = new ModalItem(el);
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
}
