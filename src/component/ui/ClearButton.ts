import { i18n } from "src/const";
import "./ClearButton.css";

/** The x at the end of a search input: shown while the input holds a Query, it empties it on click. */
export class ClearButton {
  private buttonEl: HTMLElement;

  constructor(parentEl: HTMLElement, private inputEl: HTMLInputElement) {
    // Obsidian's own class, so the icon and its colours follow the theme.
    this.buttonEl = parentEl.createDiv({
      cls: "search-input-clear-button finder-view-clear",
      attr: { "aria-label": i18n.clearQueryTitle },
    });
    // Reads the value itself rather than relying on :placeholder-shown, which needs a placeholder.
    this.inputEl.addEventListener("input", () => this.updateVisibility());
    this.updateVisibility();
  }

  public onClick(func: () => void): void {
    this.buttonEl.addEventListener("click", () => func());
  }

  private updateVisibility(): void {
    this.buttonEl.toggle(this.inputEl.value !== "");
  }
}
