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

  public setContent(date: string, path: string) {
    this.metadata.createSpan({ text: date });
    this.metadata.createSpan({ text: path, attr: { style: "margin-left: 10px; opacity: 0.6;" } });
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

class Title {
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
