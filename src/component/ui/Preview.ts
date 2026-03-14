export class Preview {
  private preview: HTMLElement

  constructor(parentEl: HTMLElement) {
    this.preview = parentEl.createDiv({ cls: 'finder-view-preview' });
  }

  public getElement(): HTMLElement {
    return this.preview
  }
}
