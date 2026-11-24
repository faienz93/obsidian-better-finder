import { emojis } from "src/const";
import "./ToggleButton.css";

export class ToggleButton {
  private toggleBtn: HTMLElement;
  private isGridView = true;

  constructor(headerEl: HTMLElement) {
    this.toggleBtn = headerEl.createEl("button", { cls: "finder-view-toggle" });
    this.toggleBtn.setAttribute("aria-label", "Toggle view");
    this.updateToggleIcon(this.toggleBtn);
  }

  public onClick(func: (isGridView: boolean) => void): void {
    this.toggleBtn.addEventListener("click", () => {
      this.isGridView = !this.isGridView;
      this.updateToggleIcon(this.toggleBtn);
      func(this.isGridView);
    });
  }

  private updateToggleIcon(btn: HTMLElement): void {
    btn.empty();

    if (this.isGridView) {
      btn.setText(emojis.listIcon);
      btn.setAttribute("title", "Switch to list view");
    } else {
      btn.setText(emojis.gridIcon);
      btn.setAttribute("title", "Switch to grid view");
    }
  }
}
