export class Metadata {
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
