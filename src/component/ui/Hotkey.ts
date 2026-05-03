export class Hotkey {
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
