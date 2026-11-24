import { ToggleButton } from "./ToggleButton";
import { ClearButton } from "./ClearButton";
import "./SearchBar.css";

export class SearchBar {
  private inputEl: HTMLInputElement;
  private resultCountEl: HTMLElement;
  private clearButton: ClearButton;
  private toggle: ToggleButton;
  private headerEl: HTMLElement;
  readonly containerEl: HTMLElement;

  constructor(parentEl: HTMLElement) {
    this.containerEl = parentEl.createDiv({ cls: "finder-view-container" });
    this.headerEl = this.containerEl.createDiv({ cls: "finder-view-header" });

    const inputWrapper = this.headerEl.createDiv({ cls: "finder-view-input-wrapper" });

    this.inputEl = inputWrapper.createEl("input", {
      type: "text",
      placeholder: "Search files...",
      cls: "finder-view-input"
    });

    this.resultCountEl = inputWrapper.createSpan({ cls: "finder-view-count" });
    this.clearButton = new ClearButton(inputWrapper, this.inputEl);
  }

  /**
   * Clicking the x empties the Query and returns focus to the input. `func` runs first because the
   * input event dispatched here is not trusted, so handlers that react only to typing ignore it.
   */
  public onClear(func: () => void) {
    this.clearButton.onClick(() => {
      func();
      this.setValue('');
      this.inputEl.focus();
    });
  }

  public setValue(value: string): void {
    this.inputEl.value = value;
    this.inputEl.dispatchEvent(new Event('input'));
  }

  public getValue(): string {
    return this.inputEl.value;
  }

  public getInputEl(): HTMLInputElement {
    return this.inputEl;
  }

  public setCounterElement(result: string) {
    this.resultCountEl.setText(result);
  }

  public onFocus() {
    this.inputEl.focus();
  }

  public onInput(func: (event?: Event) => void) {
    this.inputEl.addEventListener("input", (event) => func(event));
  }

  public createToggle(): ToggleButton {
    this.toggle = new ToggleButton(this.headerEl);

    return this.toggle;
  }

  public createActionButton(text: string, title: string, onClick: () => void): HTMLElement {
    const button = this.headerEl.createEl('button', {
      cls: 'finder-view-toggle',
      text,
      attr: { 'aria-label': title, title },
    });

    button.addEventListener('click', onClick);

    return button;
  }
}
