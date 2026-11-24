import { App, TFile } from "obsidian";
import { HintsType } from "src/component/ui/HintBar";

export interface ParsedQuery {
  rawInput: string;
  isCommandMode: boolean;
  commandText?: string;
  tags: string[];
  dateFilter?: DateRange;
  fileTypes: string[];
  scope?: 'title' | 'content';
  taskFilter?: 'all' | 'todo' | 'done';
  pathFilter?: string;
  highlightFilter?: string;
  negations?: { extensions: string[]; tags: string[] };
  metadataFilters?: Array<{ key: string; value: string }>;
  freeText: string;
}

/** The ParsedQuery fields that Filters fill. */
export type QueryField = Exclude<keyof ParsedQuery, 'rawInput' | 'isCommandMode' | 'commandText' | 'freeText'>;

/**
 * One token of a Query as a Filter receives it: the key or prefix that claimed it (empty for a bare
 * keyword) and what follows, without quotes.
 */
export interface QueryToken {
  key: string;
  value: string;
}

/**
 * Recognises its own tokens in a Query and reads them into one ParsedQuery field. A token is
 * claimed by its shape: a `prefix` (`#`, `-`), one of the `keys` of a `key:value`, or one of the
 * bare `keywords`. Shapes never overlap, so the order Filters are registered in does not matter.
 */
export abstract class QueryReader<K extends QueryField> implements HintsType {
  abstract readonly label: string;
  abstract readonly desc: string;
  abstract readonly field: K;
  readonly prefix: string = '';
  readonly keys: readonly string[] = [];
  readonly keywords: readonly string[] = [];
  /** Whether a bare `key:` takes the next free word of the Query as its value. */
  readonly takesValue: boolean = false;

  /** Whether `value` is one this Filter can read; a claimed key with a value it refuses is dropped. */
  accepts(_value: string): boolean {
    return true;
  }

  /** The field once `token` is read into it. */
  abstract read(token: QueryToken, current: ParsedQuery[K]): ParsedQuery[K];

  /** What of `token` stays in the free text. */
  freeTextOf(_token: QueryToken): string {
    return '';
  }
}

/** Narrows files by one ParsedQuery field. With the field empty, it returns the files unchanged. */
export interface Narrowing<K extends QueryField> {
  readonly field: K;
  filter(files: TFile[], value: ParsedQuery[K], app: App): TFile[];
}

/** A Filter that both reads its tokens and narrows by the field they fill. */
export abstract class SearchFilter<K extends QueryField> extends QueryReader<K> implements Narrowing<K> {
  abstract filter(files: TFile[], value: ParsedQuery[K], app: App): TFile[];
}

export type DateField = 'created' | 'modified';
export type DateValue = 'today' | 'yesterday' | 'this-week' | 'last-week' | 'this-month' | string;
export type DateRange = { field: DateField; value: DateValue };
export type TaskStatus = 'all' | 'todo' | 'done';
