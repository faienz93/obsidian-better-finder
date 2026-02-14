import { TFile } from "obsidian";


export class Metadata {
    // Metadata (sotto la preview)
    //     const metaRow = card.createDiv({ cls: 'suggestion-note' });
    //     metaRow.createSpan({ text: new Date(file.stat.mtime).toLocaleDateString() });
    // metaRow.createSpan({ text: file.parent?.path || '/', attr: { style: "margin-left: 10px; opacity: 0.6;" } });
    //   }

    private metadata: HTMLElement
    constructor(parentEl: HTMLElement) {
        // crea il div con la classe — un solo posto, nessuna duplicazione
        this.metadata = parentEl.createDiv({ cls: 'suggestion-note' });
    }

    public createMetadata(file: TFile) {
        // this.metadata.createSpan({ text: text });
        this.metadata.createSpan({ text: new Date(file.stat.mtime).toLocaleDateString() });
        this.metadata.createSpan({ text: file.parent?.path || '/', attr: { style: "margin-left: 10px; opacity: 0.6;" } });
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

    // public createPreview(text: any) {
    //     this.preview.createSpan({ text: text });
    // }

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
    // private resultsEl: HTMLElement;
    private card: HTMLElement;
    private titleEl: Title;
    private previewEl: Preview;
    private metadataEl: Metadata;

    constructor(parentEl: HTMLElement) {
        // crea il div con la classe — un solo posto, nessuna duplicazione
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


    public addMetadata(): Metadata {
        this.metadataEl = new Metadata(this.card);
        // this.previewEl.createTitle(text)
        return this.metadataEl
    }

    public getMetadata() {
        if (!this.metadataEl)
            throw new Error("Create a metadata Before");
        return this.metadataEl.getInstance()
    }


}