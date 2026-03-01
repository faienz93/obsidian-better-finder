import { HintsType } from "src/FinderController";

export class HintBar {
  private hintChips: Map<string, HTMLElement> = new Map();

  constructor(parentEl: HTMLElement, hints: HintsType, onHintClick: (hint: string) => void) {
    const hintBar = parentEl.createDiv({ cls: 'hint-bar' });

    hints.forEach(hint => {
      const chip = hintBar.createSpan({ cls: 'hint-chip' });

      chip.setText(hint.label);
      chip.setAttribute('title', hint.desc);
      this.hintChips.set(hint.label.toLowerCase(), chip);
      chip.addEventListener('click', () => onHintClick(hint.label));
    });
  }

  highlightChips(activeLabels: string[]): void {
    this.hintChips.forEach((chip, label) => {
      chip.toggleClass('hint-chip-active', activeLabels.includes(label));
    });
  }
}
