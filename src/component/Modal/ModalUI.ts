import { ResultData } from "../../engine/ResultData";
import { Body } from "../ui/Body";
import { ModalItem } from "./ModalItem";
import { Title } from "../ui/Title";

export class ModalUI {
  private item: ModalItem;
  private title!: Title;
  private body: Body;

  constructor(el: HTMLElement, body: Body) {
    this.body = body;
    this.item = new ModalItem(el);
  }

  public render(data: ResultData): void {
    const { file, tags, searchedTags, taskInfo } = data;

    this.title = this.item.setTitle(file.basename);

    if (file.extension !== 'md') {
      this.item.setBadge(this.title, ` ${file.extension.toUpperCase()}`);
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
