import { App, Component } from "obsidian";
import { CardData } from "../CardData";
import { GridCard } from "../GridCard";
import { ListCard } from "../ListCard";
import { ToggleButton } from "./ToggleButton";

type ViewMode = 'grid' | 'list';

export class CardContainer {
  private el: HTMLElement;
  private mode: ViewMode = 'grid';
  private app: App;
  private component: Component;

  constructor(parentEl: HTMLElement, toggle: ToggleButton, app: App, component: Component) {
    this.el = parentEl.createDiv({ cls: "finder-view-results grid-view" });
    this.app = app;
    this.component = component;

    toggle.onClick((isGridView) => {
      this.mode = isGridView ? 'grid' : 'list';
      this.el.toggleClass("grid-view", isGridView);
      this.el.toggleClass("list-view", !isGridView);
    });
  }

  public addResult(
    data: CardData,
    onOpen: () => void,
    onContextMenu: (event: MouseEvent) => void
  ): void {
    if (this.mode === 'grid') {
      const card = new GridCard(this.el);

      card.render(data, this.app, this.component);
      card.onClick(onOpen);
      card.onContextMenu(onContextMenu);
    } else {
      const card = new ListCard(this.el);

      card.render(data);
      card.onClick(onOpen);
      card.onContextMenu(onContextMenu);
    }
  }

  public getElement(): HTMLElement {
    return this.el;
  }

  public empty(): void {
    this.el.empty();
  }
}
