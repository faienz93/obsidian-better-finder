import { TFile } from "obsidian";
export type CardViewMode = 'grid' | 'list';
export interface Card {
  file: TFile;
  tags: string[];
  searchedTags: string[];
  taskInfo?: {
    done: number;
    total: number;
  };
}
