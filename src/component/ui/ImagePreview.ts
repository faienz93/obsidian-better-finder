import { App, Component, TFile, MarkdownRenderer } from "obsidian";
import { CodePreview } from "./CodePreview";

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

      await MarkdownRenderer.render(this.app, `![[${file.path}]]`, containerEl, '', this.component);
    } catch (e) {
      console.error('Preview error:', e);
      containerEl.setText('Preview not available');
    }
  }
}
