import { Hotkey } from "../ui/Hotkey";
import { Metadata } from "../ui/Metadata";
import { Tags } from "../ui/Tags";
import { TaskBadge } from "../ui/TaskBadge";
import { Title } from "../ui/Title";
import "../ui/SuggestionItem.css";

export class ModalItem {
  private el: HTMLElement;
  private metadata: Metadata;

  constructor(el: HTMLElement) {
    this.el = el;
    this.el.addClass('suggestion-item');
    this.metadata = new Metadata(this.el);
  }

  public setTitle(text: string): Title {
    return new Title(this.el, text);
  }

  public setBadge(titleRef: Title, text: string) {
    titleRef.addBadge(text);
  }

  public setMetadata(date: string, path?: string) {
    this.metadata.setContent(date, path);
  }

  public getMetadata(): Metadata {
    return this.metadata;
  }

  public setNote(text: string) {
    this.setMetadata(text);
  }

  public setHotkey(text: string) {
    const hotkey = new Hotkey(this.el);

    hotkey.setContent(text);
  }

  public setTags(tags: string[], searchedTags: string[]) {
    if (tags.length === 0) return;

    const tagsEl = new Tags(this.el);

    tagsEl.setContent(tags, searchedTags);
  }

  public setTaskBadge(done: number, total: number) {
    const badge = new TaskBadge(this.el);

    badge.setContent(done, total);
  }

  public setPreview(fill: (previewEl: HTMLElement) => void) {
    this.el.addClass('has-modal-preview');

    const textWrapper = createDiv({ cls: 'modal-item-text' });

    while (this.el.firstChild) {
      textWrapper.appendChild(this.el.firstChild);
    }

    this.el.appendChild(textWrapper);

    const previewEl = this.el.createDiv({ cls: 'modal-item-preview' });

    fill(previewEl);
  }
}
