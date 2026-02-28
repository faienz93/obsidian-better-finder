import { Metadata } from "./ui/Metadata";
import { Preview } from "./ui/Preview";
import { Title } from "./ui/Title";

// Re-export for backward compatibility
export { SearchBar } from "./ui/SearchBar";
export { SuggestionItem } from "./ui/SuggestionItem";
export { Title } from "./ui/Title";

export class Card {
  private card: HTMLElement;

  constructor(parentEl: HTMLElement) {
    this.card = parentEl.createDiv({ cls: 'finder-view-result' });
  }

  public getElement(): HTMLElement {
    return this.card
  }

  public setSuggestionItem() {
    this.card.addClass('suggestion-item')
  }

  public setTitle(text: string): Title {
    return new Title(this.card, text)
  }

  public setBadge(titleRef: Title, text: string) {
    titleRef.addBadge(text)
  }

  public getPreviewContainer(): HTMLElement {
    const preview = new Preview(this.card);

    return preview.getElement()
  }

  public setMetadata(date: string, path: string) {
    const metadata = new Metadata(this.card);

    metadata.setContent(date, path)
  }

  public onClick(func: (event: PointerEvent) => void) {
    this.card.addEventListener('click', (event) => func(event));
  }

  public onContextMenu(func: (event: PointerEvent) => void) {
    this.card.addEventListener('contextmenu', (event) => func(event));
  }
}
