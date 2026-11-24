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
    // The values come from the logic (DateFilter), not from the component: relative keywords and
    // the current year, plus the placeholder of the absolute format.
    this.subHintBar.setContent(
      [...DATE_VALUES, String(new Date().getFullYear())],
      i18n.dateFormatPlaceholder
    );
  }

  /**
   * Applies a date value to the query idempotently:
   * - it replaces any previous value (mutually exclusive selection)
   * - clicking the active value again removes it (deselection)
   * - it never puts a space between "field:" and the value
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

  /**
   * What a click on the Filter chip `label` makes of the query: a lit chip removes every token of
   * its Filter, values included; an unlit one appends the Filter.
   */
  static toggleFilter(query: string, label: string): string {
    const factory = SearchStrategyFactory.getInstance();
    const isLit = factory.activeHints(query).some(hint => hint.label === label);

    if (isLit) {
      const kept = factory.withoutFilter(query, label);

      return kept.length ? `${kept.join(' ')} ` : '';
    }

    return SearchUIHelper.appendToken(query, label) ?? query;
  }

  /** The query with `token` appended after its last word, or null when the query already holds it. */
  static appendToken(query: string, token: string): string | null {
    const current = query.split(' ').filter((w, i, arr) => w || i < arr.length - 1).join(' ');

    if (current.toLowerCase().includes(token.toLowerCase())) return null;

    return current ? `${current} ${token} ` : `${token} `;
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
