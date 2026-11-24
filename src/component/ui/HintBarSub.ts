import "./HintBarSub.css";

/**
 * The sub-hint bar: chips of values for one Filter, such as dates. It only draws: the values come
 * from the caller through setContent(), and it knows nothing of the Filter logic.
 */
export class HintBarSub {
  private container: HTMLElement;
  private chips: Map<string, HTMLElement> = new Map();
  private onClick: (value: string) => void;

  /** `cls` names the Filter whose values the bar holds, for its own styling. */
  constructor(parentEl: HTMLElement, onClick: (value: string) => void, cls?: string) {
    this.container = parentEl.createDiv({ cls: ['sub-hint-bar', 'is-hidden', ...(cls ? [cls] : [])] });
    this.onClick = onClick;
  }

  public setContent(values: string[], placeholder?: string): void {
    this.container.empty();
    this.chips.clear();

    for (const value of values) {
      const chip = this.container.createSpan({ cls: 'hint-chip hint-chip-sub' });

      chip.setText(value);
      chip.dataset.value = value;
      chip.addEventListener('click', () => this.onClick(value));
      this.chips.set(value, chip);
    }

    if (placeholder) {
      this.container.createSpan({ cls: 'hint-chip-format-placeholder', text: placeholder });
    }
  }

  /** Shows the bar with the chips of `activeValues` lit: one for a date, several for colours. */
  public show(...activeValues: string[]): void {
    this.container.removeClass('is-hidden');
    this.chips.forEach((chip, value) => {
      chip.toggleClass('hint-chip-active', activeValues.includes(value));
    });
  }

  public hide(): void {
    this.container.addClass('is-hidden');
  }
}
