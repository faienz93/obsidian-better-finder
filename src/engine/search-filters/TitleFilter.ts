import { App, TFile } from "obsidian";
import { i18n } from "src/const";
import { SearchIndex } from "../SearchIndex";
import { SearchFilter } from "./types";

// TODO: ScopeFilter non rispetta ISP — extract() restituisce già remainingText,
// quindi removeFrom() è ridondante. Da valutare se separare in futuro.
export class TitleFilter extends SearchFilter<{ scope?: 'title' | 'content'; remainingText: string }> {
  readonly label = 'title:';
  readonly desc = i18n.title;

  extract(query: string): { scope?: 'title' | 'content'; remainingText: string } {
    const titleMatch = query.match(/\btitle:\s*(\S+)/i);

    if (titleMatch) {
      const searchTerm = titleMatch[1];
      const remainingText = query.replace(/\btitle:\s*\S+/i, searchTerm).trim();

      return { scope: 'title', remainingText };
    }

    return { scope: undefined, remainingText: query };
  }

  // Rimuove il prefisso "title:" mantenendo il termine di ricerca come testo libero
  removeFrom(query: string): string {
    return query.replace(/\btitle:\s*/i, '').trim();
  }

  filter(files: TFile[], extracted: { scope?: "title" | "content"; remainingText: string; }, app: App): TFile[] {
    const searchIndex = SearchIndex.getInstance(app);

    return searchIndex.searchInTitlesWithoutIndex(extracted.remainingText, files);
  }
}
