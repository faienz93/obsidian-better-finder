import { App, TFile } from "obsidian";
import "./SnippetPreview.css";

const CONTEXT_CHARS = 60;

/**
 * Estratto del contenuto attorno al termine cercato, con il termine evidenziato.
 * Pattern gemello di ImagePreview: il chiamante decide se mostrarlo, questo
 * componente si occupa solo di caricare e renderizzare.
 */
export class SnippetPreview {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  public async load(file: TFile, term: string, el: HTMLElement): Promise<void> {
    if (file.extension !== 'md' || !term) return;

    try {
      const content = await this.app.vault.cachedRead(file);
      const idx = content.toLowerCase().indexOf(term.toLowerCase());

      if (idx === -1) return;

      const start = Math.max(0, idx - CONTEXT_CHARS);
      const end = Math.min(content.length, idx + term.length + CONTEXT_CHARS);
      const snippet = content.slice(start, end).replace(/\s+/g, ' ');

      el.addClass('snippet-preview');
      this.renderHighlighted(el, snippet, term, start > 0, end < content.length);
    } catch {
      // Nessuno snippet in caso di errore di lettura: il risultato resta valido
    }
  }

  private renderHighlighted(el: HTMLElement, text: string, term: string, leadingEllipsis: boolean, trailingEllipsis: boolean): void {
    if (leadingEllipsis) el.appendText('… ');

    const lowerText = text.toLowerCase();
    const lowerTerm = term.toLowerCase();
    let pos = 0;

    for (;;) {
      const idx = lowerText.indexOf(lowerTerm, pos);

      if (idx === -1) break;

      el.appendText(text.slice(pos, idx));
      el.createEl('mark', { text: text.slice(idx, idx + term.length), cls: 'snippet-highlight' });
      pos = idx + term.length;
    }

    el.appendText(text.slice(pos));

    if (trailingEllipsis) el.appendText(' …');
  }
}
