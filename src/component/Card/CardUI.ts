import { App, Component } from "obsidian";
import { ResultData } from "../../engine/ResultData";
import { GridCard } from "./GridCard";
import { ListCard } from "./ListCard";
import { ToggleButton } from "../ui/ToggleButton";
import { Body } from "../ui/Body";
import "./CardUI.css";

export type CardViewMode = 'grid' | 'list';

export class CardUI {
  private el: HTMLElement;
  private mode: CardViewMode = 'grid';
  private body: Body;

  constructor(parentEl: HTMLElement, toggle: ToggleButton, app: App, component: Component) {
    this.el = parentEl.createDiv({ cls: "finder-view-results grid-view" });
    this.body = new Body(app, component);

    toggle.onClick((isGridView) => {
      this.mode = isGridView ? 'grid' : 'list';
      this.el.toggleClass("grid-view", isGridView);
      this.el.toggleClass("list-view", !isGridView);
    });
  }

  public render(
    data: ResultData,
    onOpen: () => void,
    onContextMenu: (event: MouseEvent) => void
  ): void {
    const card = this.mode === 'grid' ? new GridCard(this.el, this.body) : new ListCard(this.el, this.body);

    card.render(data);
    card.onClick(onOpen);
    card.onContextMenu(onContextMenu);
  }

  public getElement(): HTMLElement {
    return this.el;
  }

  /** Removes every drawn result; also call it when the view closes. */
  public empty(): void {
    this.body.reset();
    this.el.empty();
  }
}
