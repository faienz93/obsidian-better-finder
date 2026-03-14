export class CodePreview {
  constructor(parentEl: HTMLElement, text: string) {
    const codeEl = parentEl.createEl('pre', { cls: 'code-preview' });

    codeEl.createEl('code', { text });
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
  }
}
