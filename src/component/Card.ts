

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
