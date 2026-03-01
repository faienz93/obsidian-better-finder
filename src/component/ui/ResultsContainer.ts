import { ToggleButton } from "./ToggleButton";

export class ResultsContainer {
  private el: HTMLElement;

  constructor(parentEl: HTMLElement, toggle: ToggleButton) {
    this.el = parentEl.createDiv({ cls: "finder-view-results grid-view" });

    toggle.onClick((isGridView) => {
      this.el.toggleClass("grid-view", isGridView);
      this.el.toggleClass("list-view", !isGridView);
    });
  }

  public getElement(): HTMLElement {
    return this.el;
  }

  public empty(): void {
    this.el.empty();
  }
}
