import { App, Component } from "obsidian";
import { ResultData } from "../../engine/ResultData";
import { ImagePreview } from "../ui/ImagePreview";
import { SnippetPreview } from "../ui/SnippetPreview";
import { TaskSnippet } from "../ui/TaskSnippet";
import { ModalItem } from "./ModalItem";
import { Title } from "../ui/Title";

export class ModalUI {
  private item: ModalItem;
  private title!: Title;
  private app: App;

  constructor(el: HTMLElement, app: App) {
    this.app = app;
    this.item = new ModalItem(el);
  }

  public render(data: ResultData): void {
    const { file, tags, searchedTags, taskInfo, renderPreview, snippetTerm, taskSnippet } = data;

    this.title = this.item.setTitle(file.basename);

    if (file.extension !== 'md') {
      this.item.setBadge(this.title, ` ${file.extension.toUpperCase()}`);
    }

    this.item.setMetadata(
      new Date(file.stat.mtime).toLocaleDateString(),
      file.parent?.path || '/'
    );

    // Con filtro task attivo il testo dei task ha priorità sullo snippet generico
    if (taskSnippet) {
      this.item.setSnippet((snippetEl) => {
        new TaskSnippet(this.app).load(file, taskSnippet, snippetEl);
      });
    } else if (snippetTerm) {
      this.item.setSnippet((snippetEl) => {
        new SnippetPreview(this.app).load(file, snippetTerm, snippetEl);
      });
    }

    if (renderPreview) {
      this.item.setPreview((previewEl) => {
        new ImagePreview(this.app, new Component()).load(file, previewEl);
      });
    }

    this.item.setTags(tags, searchedTags);

    if (taskInfo && taskInfo.total > 0) {
      this.item.setTaskBadge(taskInfo.done, taskInfo.total);
    }
  }
}
