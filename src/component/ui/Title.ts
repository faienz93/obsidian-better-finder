import { setIcon } from "obsidian";
import { FileTypeIcon } from "../../engine/fileTypeIcon";
import "./Title.css";

export class Title {
  private title: HTMLElement

  constructor(parentEl: HTMLElement, text: string) {
    this.title = parentEl.createDiv({ cls: 'suggestion-title' });
    this.title.createSpan({ text });
  }

  public addBadge(text: string) {
    this.title.createSpan({ text, cls: 'suggestion-flair' });
  }

  public addTypeIcon({ icon, label }: FileTypeIcon) {
    const iconEl = this.title.createSpan({ cls: 'finder-type-icon', attr: { 'aria-label': label } });

    setIcon(iconEl, icon);
  }
}
