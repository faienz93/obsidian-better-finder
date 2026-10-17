import { App, Component, TFile, MarkdownRenderer, setIcon } from "obsidian";
import { XbergExtractor } from "../../engine/XbergExtractor";
import { CodePreview } from "./CodePreview";
import "./ImagePreview.css";

const OFFICE_ICONS: Record<string, string> = {
  docx: 'file-text',
  xlsx: 'table',
};

const EMBED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'canvas', 'pdf'];

export class ImagePreview {
  constructor(private app: App, private component: Component) {}

  /**
   * The single answer to "does this file get a Preview?", shared by every UI.
   * A note showing a Snippet gets none: the Snippet already shows its content.
   */
  public static hasPreview(app: App, file: TFile, options: { hasSnippet: boolean }): boolean {
    const ext = file.extension.toLowerCase();

    if (ext === 'md') {
      return ImagePreview.isExcalidraw(app, file) || !options.hasSnippet;
    }

    return EMBED_EXTENSIONS.includes(ext) || ext === 'json' || ext in OFFICE_ICONS;
  }

  private static isExcalidraw(app: App, file: TFile): boolean {
    return app.metadataCache.getFileCache(file)?.frontmatter?.['excalidraw-plugin'] === 'parsed';
  }

  public async load(file: TFile, containerEl: HTMLElement): Promise<void> {
    containerEl.empty();
    const ext = file.extension.toLowerCase();

    try {
      // Excalidraw drawings are .md files but render as an embed, like images.
      if (ext === 'md' && !ImagePreview.isExcalidraw(this.app, file)) {
        const rawContent = await this.app.vault.cachedRead(file);
        const cleaned = rawContent.replace(/^---[\s\S]*?---\n?/, '').slice(0, 500);

        await MarkdownRenderer.render(this.app, cleaned, containerEl, file.path, this.component);

        return;
      }

      if (ext === 'json') {
        containerEl.addClass('code-thumbnail');
        const rawContent = await this.app.vault.cachedRead(file);

        new CodePreview(containerEl, rawContent.slice(0, 300));

        return;
      }

      if (ext in OFFICE_ICONS) {
        await this.loadOfficePreview(file, ext, containerEl);

        return;
      }

      await MarkdownRenderer.render(this.app, `![[${file.path}]]`, containerEl, '', this.component);
    } catch (e) {
      console.error('Preview error:', e);
      containerEl.setText('Preview not available');
    }
  }

  /**
   * Preview per docx/xlsx: icona + badge estensione; se Xberg è disponibile,
   * mostra anche un estratto testuale del contenuto.
   */
  private async loadOfficePreview(file: TFile, ext: string, containerEl: HTMLElement): Promise<void> {
    containerEl.addClass('office-thumbnail');

    const iconEl = containerEl.createDiv({ cls: 'office-thumbnail-icon' });

    setIcon(iconEl, OFFICE_ICONS[ext]);
    containerEl.createDiv({ cls: 'office-thumbnail-ext', text: ext.toUpperCase() });

    const text = await XbergExtractor.getInstance(this.app).getText(file);

    if (text) {
      containerEl.createDiv({ cls: 'office-thumbnail-text', text: text.slice(0, 200) });
    }
  }
}
