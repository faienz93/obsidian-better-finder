import { App, Component, MarkdownRenderer, TFile } from "obsidian";

export class Preview {
  private preview: HTMLElement

  constructor(parentEl: HTMLElement) {
    this.preview = parentEl.createDiv({ cls: 'finder-view-preview' });
  }

  public getElement(): HTMLElement {
    return this.preview
  }

  async render(file: TFile, app: App, component: Component): Promise<void> {
    this.preview.empty();
    const ext = file.extension.toLowerCase();

    try {
      if (ext === 'md') {
        const rawContent = await app.vault.cachedRead(file);
        const cleaned = rawContent.replace(/^---[\s\S]*?---\n?/, '').slice(0, 500);

        await MarkdownRenderer.render(app, cleaned, this.preview, file.path, component);

        return;
      }

      if (ext === 'json') {
        this.preview.addClass('code-thumbnail');
        const rawContent = await app.vault.cachedRead(file);
        const codeEl = this.preview.createEl('pre', { cls: 'code-preview' });

        codeEl.createEl('code', { text: rawContent.slice(0, 300) });
        codeEl.setCssStyles({
          fontSize: '9px',
          lineHeight: '1.2',
          overflow: 'hidden',
          margin: '0',
          padding: '8px',
          background: 'var(--background-secondary)',
          color: 'var(--text-muted)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        });

        return;
      }

      await MarkdownRenderer.render(app, `![[${file.path}]]`, this.preview, '', component);
    } catch (e) {
      console.error('Preview error:', e);
      this.preview.setText('Preview not available');
    }
  }
}
