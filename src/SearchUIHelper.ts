import { App } from "obsidian";
import { HintBar } from "./component/ui/HintBar";
import { HintBarSub } from "./component/ui/HintBarSub";
import { TagsPreview } from "./component/ui/TagsPreview";
import { DATE_VALUES, DATE_VALUE_PATTERN } from "./engine/search-filters/DateFilter";
import { SearchStrategyFactory } from "./engine/SearchStrategy";
import { Finder } from "./Finder";
import { i18n } from "./const";

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
    // I valori mostrati arrivano dalla logica (DateFilter), non dal componente:
    // keyword relative + anno corrente, più il placeholder del formato assoluto.
    this.subHintBar.setContent(
      [...DATE_VALUES, String(new Date().getFullYear())],
      i18n.dateFormatPlaceholder
    );
  }

  /**
   * Applica un valore data alla query in modo idempotente:
   * - sostituisce l'eventuale valore precedente (selezione mutuamente esclusiva)
   * - ricliccando il valore attivo lo rimuove (deselezione)
   * - non introduce mai lo spazio tra "campo:" e valore
   */
  static toggleDateValue(query: string, value: string): string {
    const pattern = new RegExp(`\\b(created|modified):(?:\\s?(${DATE_VALUE_PATTERN}))?(?=\\s|$)`, 'i');
    const match = pattern.exec(query);

    if (!match) return query;

    const field = match[1];
    const current = match[2] ?? '';
    const newToken = current.toLowerCase() === value.toLowerCase() ? `${field}:` : `${field}:${value}`;

    return query.replace(match[0], newToken);
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
