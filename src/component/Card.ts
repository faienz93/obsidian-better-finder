// TODO creare diversi file

import { emojis } from "src/const";

export class SearchBar {
  private inputEl: HTMLInputElement;
  private resultCountEl: HTMLElement;
  private toggle: ToggleButton;
  private headerEl: HTMLElement

  constructor(parentEl: HTMLElement) {
    this.headerEl = parentEl.createDiv({ cls: "finder-view-header" });

    // Input wrapper (contiene input + contatore)
    const inputWrapper = this.headerEl.createDiv({ cls: "finder-view-input-wrapper" });

    this.inputEl = inputWrapper.createEl("input", {
      type: "text",
      placeholder: "Search files...",
      cls: "finder-view-input"
    });

    this.resultCountEl = inputWrapper.createSpan({ cls: "finder-view-count" });

    // this.toggle = new ToggleButton(headerEl);
  }

  public setValue(hint: string): void {
    this.inputEl.value = hint;
  }

  public getValue(): string {
    return this.inputEl.value;
  }

  public setCounterElement(result: string) {
    this.resultCountEl.setText(result);
  }

  public onFocus() {
    this.inputEl.focus();
  }

  public onInput(func: (event?: Event) => void) {
    this.inputEl.addEventListener("input", (event) => func(event));
  }

  public createToggle(): ToggleButton {
    this.toggle = new ToggleButton(this.headerEl);

    return this.toggle
  }
}

export class ToggleButton {
  private toggleBtn: HTMLElement;
  private isGridView = true;
  constructor(headerEl: HTMLElement) {
    this.toggleBtn = headerEl.createEl("button", { cls: "finder-view-toggle" });
    this.toggleBtn.setAttribute("aria-label", "Toggle view");
    this.updateToggleIcon(this.toggleBtn);
  }

  // public onClick(func: (event: PointerEvent) => void) {
  //   this.card.addEventListener('click', (event) => func(event));
  // }

  public onClick(func: (isGridView: boolean) => void): void {
    this.toggleBtn.addEventListener("click", () => {
      this.isGridView = !this.isGridView;
      this.updateToggleIcon(this.toggleBtn);
      func(this.isGridView);
    });
  }

  private updateToggleIcon(btn: HTMLElement): void {
    btn.empty();

    if (this.isGridView) {
      btn.setText(emojis.listIcon); // List icon
      btn.setAttribute("title", "Switch to list view");
    } else {
      btn.setText(emojis.gridIcon); // Grid icon
      btn.setAttribute("title", "Switch to grid view");
    }
  }
}

class Metadata {
  private metadata: HTMLElement
  constructor(parentEl: HTMLElement) {
    this.metadata = parentEl.createDiv({ cls: 'suggestion-note' });
  }

  public setContent(primary: string, secondary?: string) {
    this.metadata.createSpan({ text: primary });

    if (secondary) {
      this.metadata.createSpan({ text: secondary, attr: { style: "margin-left: 10px; opacity: 0.6;" } });
    }
  }
}

class Hotkey {
  private hotkey: HTMLElement;

  constructor(parentEl: HTMLElement) {
    this.hotkey = parentEl.createDiv();
    this.hotkey.setCssStyles({
      marginTop: '4px',
      fontSize: '11px',
      color: 'var(--text-accent)',
    });
  }

  public setContent(text: string) {
    this.hotkey.setText(`⌨️ ${text}`);
  }
}

class Tags {
  private container: HTMLElement;

  constructor(parentEl: HTMLElement) {
    this.container = parentEl.createDiv();
    this.container.setCssStyles({
      marginTop: '8px',
      display: 'flex',
      gap: '4px',
      flexWrap: 'wrap',
    });
  }

  public setContent(tags: string[], searchedTags: string[]) {
    tags.forEach(tag => {
      const tagEl = this.container.createSpan({ text: tag });

      tagEl.setCssStyles({
        background: 'var(--tag-background)',
        color: 'var(--tag-color)',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '11px',
      });

      const isMatched = searchedTags.some(st => tag.toLowerCase() === st.toLowerCase());

      if (isMatched) {
        tagEl.setCssStyles({
          background: 'var(--interactive-accent)',
          color: 'var(--text-on-accent)',
          fontWeight: '600',
        });
      }
    });
  }
}

class TaskBadge {
  private badge: HTMLElement;

  constructor(parentEl: HTMLElement) {
    this.badge = parentEl.createDiv();
    this.badge.setCssStyles({
      marginTop: '6px',
      fontSize: '11px',
      color: 'var(--text-muted)',
    });
  }

  public setContent(done: number, total: number) {
    this.badge.setText(`✓ ${done}/${total} tasks completed`);
  }
}

class Preview {
  private preview: HTMLElement
  constructor(parentEl: HTMLElement) {
    this.preview = parentEl.createDiv({ cls: 'finder-view-preview' });
  }

  public getElement(): HTMLElement {
    return this.preview
  }
}

export class Title {
  private title: HTMLElement
  constructor(parentEl: HTMLElement, text: string) {
    this.title = parentEl.createDiv({ cls: 'suggestion-title' });
    this.title.createSpan({ text });
  }

  public addBadge(text: string) {
    this.title.createSpan({ text, cls: 'suggestion-flair' });
  }
}

export class Card {
  private card: HTMLElement;

  constructor(parentEl: HTMLElement) {
    this.card = parentEl.createDiv({ cls: 'finder-view-result' });
  }

  public getElement(): HTMLElement {
    return this.card
  }

  public setSuggestionItem() {
    this.card.addClass('suggestion-item')
  }

  public setTitle(text: string): Title {
    return new Title(this.card, text)
  }

  public setBadge(titleRef: Title, text: string) {
    titleRef.addBadge(text)
  }

  public getPreviewContainer(): HTMLElement {
    const preview = new Preview(this.card);

    return preview.getElement()
  }

  public setMetadata(date: string, path: string) {
    const metadata = new Metadata(this.card);

    metadata.setContent(date, path)
  }

  public onClick(func: (event: PointerEvent) => void) {
    this.card.addEventListener('click', (event) => func(event));
  }

  public onContextMenu(func: (event: PointerEvent) => void) {
    this.card.addEventListener('contextmenu', (event) => func(event));
  }
}

export class SuggestionItem {
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
}
