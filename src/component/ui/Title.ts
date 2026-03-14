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
