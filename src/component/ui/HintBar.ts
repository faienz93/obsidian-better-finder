export type HintsType = { label: string, desc: string }

export class HintChip {
  private chip: HTMLElement;
  readonly label: string;

  constructor(parentEl: HTMLElement, hint: HintsType, onClick: (label: string) => void) {
    this.label = hint.label.toLowerCase();
    this.chip = parentEl.createSpan({ cls: 'hint-chip' });
    this.chip.setText(hint.label);
    this.chip.setAttribute('title', hint.desc);
    this.chip.addEventListener('click', () => onClick(hint.label));
  }

  setActive(active: boolean): void {
    this.chip.toggleClass('hint-chip-active', active);
  }
}

export class HintBar {
  private chips: HintChip[] = [];
  private hintBar: HTMLElement;

  constructor(parentEl: HTMLElement) {
    this.hintBar = parentEl.createDiv({ cls: 'hint-bar' });
  }

  addHint(hint: HintsType, onClick: (label: string) => void): void {
    this.chips.push(new HintChip(this.hintBar, hint, onClick));
  }

  highlightChips(activeLabels: string[]): void {
    this.chips.forEach(chip => chip.setActive(activeLabels.includes(chip.label)));
  }
}
