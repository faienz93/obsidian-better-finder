import { App } from "obsidian";
import { HintBar } from "./component/ui/HintBar";
import { HintBarSub } from "./component/ui/HintBarSub";
import { TagsPreview } from "./component/ui/TagsPreview";
import { SearchStrategyFactory } from "./engine/SearchStrategy";
import { Finder } from "./Finder";

export interface SearchUICallbacks {
  onHintClick: (label: string) => void;
  onDateFilterClick: (value: string) => void;
}

export class SearchUIHelper {
  private hintBar!: HintBar;
  private subHintBar!: HintBarSub;
  private tagsPreview: TagsPreview | null = null;
  private core: Finder;
  private app: App;

  constructor(app: App, core: Finder, containerEl: HTMLElement, callbacks?: Partial<SearchUICallbacks>) {
    this.app = app;
    this.core = core;
    this.buildUI(containerEl, callbacks ?? {});
  }

  private buildUI(containerEl: HTMLElement, callbacks: Partial<SearchUICallbacks>) {
    this.hintBar = new HintBar(containerEl);
    this.core.hints.forEach(hint => {
      this.hintBar.addHint(hint, (label) => {
        callbacks.onHintClick?.(label);
      });
    });
    this.tagsPreview = new TagsPreview(containerEl);
    this.subHintBar = new HintBarSub(containerEl, (value) => {
      callbacks.onDateFilterClick?.(value);
    });
  }

  onInput(query: string, inputEl: HTMLInputElement) {
    this.hintBar.highlightChips(this.core.getActiveHints(query));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.tagsPreview?.updateTagPreview((this.app.metadataCache as any).getTags() || {}, inputEl);

    const parsed = SearchStrategyFactory.getInstance().parse(query);

    if (parsed.dateFilter) {
      this.subHintBar.show(parsed.dateFilter.value);
    } else if (/\b(modified|created):/.test(query)) {
      this.subHintBar.show();
    } else {
      this.subHintBar.hide();
    }
  }
}
