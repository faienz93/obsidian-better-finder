import { TFile } from "obsidian";

export interface CardData {
  file: TFile;
  tags: string[];
  searchedTags: string[];
  taskInfo?: {
    done: number;
    total: number;
  };
}
