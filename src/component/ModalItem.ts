import { TFile } from "obsidian";
import { SuggestionItem } from "./ui/SuggestionItem";
import { Title } from "./ui/Title";

export interface ModalData {
  file: TFile;
  tags: string[];
  searchedTags: string[];
  taskInfo?: {
    done: number;
    total: number;
  };
}

export class ModalItem {
  private item: SuggestionItem;
  private title: Title;

  constructor(el: HTMLElement) {
    this.item = new SuggestionItem(el);
  }

  public render(data: ModalData): void {
    const { file, tags, searchedTags, taskInfo } = data;

    this.title = this.item.setTitle(file.basename);

    if (file.extension !== 'md') {
      this.item.setBadge(this.title, ` ${file.extension.toUpperCase()}`);
    }

    this.item.setMetadata(
      new Date(file.stat.mtime).toLocaleDateString(),
      file.parent?.path || '/'
    );

    if (file.extension !== 'md') return;

    if (tags.length > 0) {
      this.item.setTags(tags, searchedTags);
    }

    if (taskInfo && taskInfo.total > 0) {
      this.item.setTaskBadge(taskInfo.done, taskInfo.total);
    }
  }
}
