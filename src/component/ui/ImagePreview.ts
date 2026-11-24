import { App, Component, TFile, MarkdownRenderer, setIcon } from "obsidian";
import { XbergExtractor } from "../../engine/XbergExtractor";
import { isDrawingDataExposed, isExcalidraw } from "../../engine/excalidraw";
import { i18n } from "../../const";
import { CodePreview } from "./CodePreview";
import { PdfPreview } from "./PdfPreview";
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
      return isExcalidraw(app, file) || !options.hasSnippet;
    }

    return EMBED_EXTENSIONS.includes(ext) || ext === 'json' || ext in OFFICE_ICONS;
  }

  public async load(file: TFile, containerEl: HTMLElement): Promise<void> {
    containerEl.empty();
    const ext = file.extension.toLowerCase();

    try {
      // Excalidraw drawings are .md files but render as an embed, like images.
      if (ext === 'md' && !isExcalidraw(this.app, file)) {
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

      if (ext === 'pdf') {
        await PdfPreview.getInstance(this.app).draw(file, containerEl);

        return;
      }

      if (ext === 'md' && isDrawingDataExposed(await this.app.vault.cachedRead(file))) {
        this.drawBrokenDrawing(containerEl);

        return;
      }

      await MarkdownRenderer.render(this.app, `![[${file.path}]]`, containerEl, '', this.component);
    } catch (e) {
      console.error('Preview error:', e);
      containerEl.setText('Preview not available');
    }
  }

  /** Embedding this drawing would freeze Obsidian for seconds: say what is wrong instead. */
  private drawBrokenDrawing(containerEl: HTMLElement): void {
    containerEl.addClass('broken-drawing');
    containerEl.setAttribute('title', i18n.brokenDrawing);
    setIcon(containerEl.createDiv({ cls: 'broken-drawing-icon' }), 'alert-triangle');
    containerEl.createDiv({ cls: 'broken-drawing-text', text: i18n.brokenDrawing });
  }

  /**
   * Preview for docx/xlsx: an icon and the extension badge, plus a text excerpt when Xberg is
   * available.
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
