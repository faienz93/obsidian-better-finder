import { App, Component, TFile, MarkdownRenderer, setIcon } from "obsidian";
import { XbergExtractor } from "../../engine/XbergExtractor";
import { CodePreview } from "./CodePreview";
import "./ImagePreview.css";

const OFFICE_ICONS: Record<string, string> = {
  docx: 'file-text',
  xlsx: 'table',
};

export class ImagePreview {
  constructor(private app: App, private component: Component) {}

  public async load(file: TFile, containerEl: HTMLElement): Promise<void> {
    containerEl.empty();
    const ext = file.extension.toLowerCase();

    try {
      const cache = this.app.metadataCache.getFileCache(file);

      if (cache?.frontmatter?.['excalidraw-plugin'] === 'parsed') {
        await MarkdownRenderer.render(this.app, `![[${file.path}]]`, containerEl, '', this.component);

        return;
      }

      if (ext === 'md') {
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
