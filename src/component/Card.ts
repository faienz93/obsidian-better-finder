


export class Metadata {

  private metadata: HTMLElement
  constructor(parentEl: HTMLElement) {
    // crea il div con la classe — un solo posto, nessuna duplicazione
    this.metadata = parentEl.createDiv({ cls: 'suggestion-note' });
  }

  public setContent(date: string, path: string) {
    this.metadata.createSpan({ text: date });
    this.metadata.createSpan({ text: path, attr: { style: "margin-left: 10px; opacity: 0.6;" } });
  }

  public getInstance(): HTMLElement {
    return this.metadata
  }
}
export class Preview {
  private preview: HTMLElement
  constructor(parentEl: HTMLElement) {
    // crea il div con la classe — un solo posto, nessuna duplicazione
    this.preview = parentEl.createDiv({ cls: 'finder-view-preview' });
  }

  public getInstance(): HTMLElement {
    return this.preview
  }
}


export class Title {
  private title: HTMLElement
  constructor(parentEl: HTMLElement) {
    // crea il div con la classe — un solo posto, nessuna duplicazione
    this.title = parentEl.createDiv({ cls: 'suggestion-title' });
  }

  public createTitle(text: any) {
    this.title.createSpan({ text: text });
  }

  public getInstance(): HTMLElement {
    return this.title
  }

  public createCustomSpan(text: any) {
    const extBadge = this.title.createSpan({
      text: text,
      cls: 'suggestion-flair'
    });
    extBadge.setCssStyles({
      marginLeft: '8px',
      fontSize: '10px',
      padding: '2px 6px',
      background: 'var(--background-modifier-success)',
      borderRadius: '3px'
    });
    return extBadge
  }
}

export class Card {
  private card: HTMLElement;
  private titleEl?: Title;
  private previewEl?: Preview;
  private metadataEl?: Metadata;

  constructor(parentEl: HTMLElement) {
    this.card = parentEl.createDiv({ cls: 'finder-view-result' });
  }

  public getElement() {
    return this.card
  }

  public setSuggestionItem() {
    this.card.addClass('suggestion-item')
  }

  public addTitle(text: any): Title {
    this.titleEl = new Title(this.card);
    this.titleEl.createTitle(text)
    return this.titleEl
  }

  public getTitle() {
    if (!this.titleEl)
      throw new Error("Create a Title Before");
    return this.titleEl.getInstance()
  }

  public addPreview(): Preview {
    this.previewEl = new Preview(this.card);
    // this.previewEl.createTitle(text)
    return this.previewEl
  }

  public getPreview() {
    if (!this.previewEl)
      throw new Error("Create a Preview Before");
    return this.previewEl.getInstance()
  }

  public onClick(func: (event: PointerEvent) => void) {
    this.card.addEventListener('click', (event) => func(event));
  }


  public onContextMenu(func: (event: PointerEvent) => void) {
    this.card.addEventListener('contextmenu', (event) => func(event));
  }



  public addMetadata(): Metadata {
    this.metadataEl = new Metadata(this.card);
    return this.metadataEl
  }

  public getMetadata() {
    if (!this.metadataEl)
      throw new Error("Create a metadata Before");
    return this.metadataEl.getInstance()
  }


}
