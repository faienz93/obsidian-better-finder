import { App, TFile } from "obsidian";
import { i18n } from "src/const";
import { SearchIndex } from "../SearchIndex";
import { QueryReader, QueryToken } from "./types";

/** `title:term` narrows the free text to titles; the term itself stays in the free text. */
export class TitleFilter extends QueryReader<'scope'> {
  readonly label = 'title:';
  readonly desc = i18n.title;
  readonly field = 'scope';
  readonly keys = ['title'];
  readonly takesValue = true;

  read(): 'title' {
    return 'title';
  }

  freeTextOf(token: QueryToken): string {
    return token.value;
  }

  filter(files: TFile[], freeText: string, app: App): TFile[] {
    const searchIndex = SearchIndex.getInstance(app);

    return searchIndex.searchInTitlesWithoutIndex(freeText, files);
  }
}
