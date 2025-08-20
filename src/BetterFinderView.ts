import { ItemView, WorkspaceLeaf } from "obsidian";

export const VIEW_TYPE_BETTERFINDER = "better-finder-view";

export class BetterFinderView extends ItemView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_BETTERFINDER;
    }

    getDisplayText() {
        return "Better Finder";
    }

    async onOpen() {
        const container = this.containerEl;
        container.empty();

        // barra di ricerca
        const input = container.createEl("input", {
            type: "text",
            placeholder: "Cerca #tag ...",
            cls: "better-finder-input"
        });

        // area risultati
        const results = container.createEl("div", { cls: "better-finder-results" });

        input.addEventListener("input", () => {
            results.setText("Risultati per: " + input.value);
        });
    }

    async onClose() { }
}
