import { ToggleButton } from "./ToggleButton";

export class SearchBar {
  private inputEl: HTMLInputElement;
  private resultCountEl: HTMLElement;
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

    return this.toggle
  }
}
