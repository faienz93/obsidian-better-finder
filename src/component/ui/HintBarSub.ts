import "./HintBarSub.css";

/**
 * Barra dei sub-hint (chip di valori per un filtro, es. le date).
 * Componente di solo rendering: i valori da mostrare arrivano dal chiamante
 * via setContent(), il componente non conosce la logica dei filtri.
 */
export class HintBarSub {
  private container: HTMLElement;
  private chips: Map<string, HTMLElement> = new Map();
  private onClick: (value: string) => void;

  constructor(parentEl: HTMLElement, onClick: (value: string) => void) {
    this.container = parentEl.createDiv({ cls: 'sub-hint-bar is-hidden' });
    this.onClick = onClick;
  }

  public setContent(values: string[], placeholder?: string): void {
    this.container.empty();
    this.chips.clear();

    for (const value of values) {
      const chip = this.container.createSpan({ cls: 'hint-chip hint-chip-sub' });

      chip.setText(value);
      chip.addEventListener('click', () => this.onClick(value));
      this.chips.set(value, chip);
    }

    if (placeholder) {
      this.container.createSpan({ cls: 'hint-chip-format-placeholder', text: placeholder });
    }
  }

  public show(activeValue?: string): void {
    this.container.removeClass('is-hidden');
    this.chips.forEach((chip, value) => {
      chip.toggleClass('hint-chip-active', value === activeValue);
    });
  }

  public hide(): void {
    this.container.addClass('is-hidden');
  }
}
