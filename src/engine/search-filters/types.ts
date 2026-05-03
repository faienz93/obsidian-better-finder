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
  freeText: string;
}

export interface SearchStrategyInterface<TResult> {
  extract(query: string): TResult;
  removeFrom(query: string): string;
}

export interface Filterable<TResult> {
  filter(files: TFile[], extracted: TResult, app: App): TFile[];
}

export type DateField = 'created' | 'modified';
export type DateValue = 'today' | 'yesterday' | 'this-week' | 'last-week' | 'this-month' | string;
export type DateRange = { field: DateField; value: DateValue };
export type TaskStatus = 'all' | 'todo' | 'done';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isFilterable = (strategy: any): strategy is Filterable<unknown> => {
  return typeof strategy.filter === 'function';
}

export abstract class SearchFilter<TResult> implements SearchStrategyInterface<TResult>, Filterable<TResult>, HintsType {
  abstract readonly label: string;
  abstract readonly desc: string;
  abstract filter(files: TFile[], extracted: TResult, app: App): TFile[]

  abstract extract(query: string): TResult
  abstract removeFrom(query: string): string
}

export interface AsyncFilterable<TResult> {
  filterAsync(files: TFile[], extracted: TResult, app: App): Promise<TFile[]>;
}

export abstract class SearchFilterAsync<TResult> implements SearchStrategyInterface<TResult>, AsyncFilterable<TResult>, HintsType {
  abstract readonly label: string;
  abstract readonly desc: string;
  abstract filterAsync(files: TFile[], extracted: TResult, app: App): Promise<TFile[]>

  abstract extract(query: string): TResult
  abstract removeFrom(query: string): string
}
