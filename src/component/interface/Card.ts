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
  renderPreview?: boolean;
  /** Termine di ricerca libero da evidenziare nello snippet di contenuto */
  snippetTerm?: string;
  /** Se il filtro task è attivo: mostra il testo dei task con questo stato */
  taskSnippet?: 'all' | 'todo' | 'done';
}
