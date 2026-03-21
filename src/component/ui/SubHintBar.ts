const DATE_VALUES = ['today', 'yesterday', 'this-week', 'last-week', 'this-month', 'last-month'];

export class SubHintBar {
  private container: HTMLElement;
  private chips: Map<string, HTMLElement> = new Map();

  constructor(parentEl: HTMLElement, onClick: (value: string) => void) {
    this.container = parentEl.createDiv({ cls: 'sub-hint-bar' });
    this.container.style.display = 'none';

    for (const value of DATE_VALUES) {
      const chip = this.container.createSpan({ cls: 'hint-chip hint-chip-sub' });

      chip.setText(value);
      chip.addEventListener('click', () => onClick(value));
      this.chips.set(value, chip);
    }
  }

  show(activeValue?: string): void {
    this.container.style.display = '';
    this.chips.forEach((chip, value) => {
      chip.toggleClass('hint-chip-active', value === activeValue);
    });
  }

  hide(): void {
    this.container.style.display = 'none';
  }
}
