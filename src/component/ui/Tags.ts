export class Tags {
  private container: HTMLElement;

  constructor(parentEl: HTMLElement) {
    this.container = parentEl.createDiv();
    this.container.setCssStyles({
      marginTop: '8px',
      display: 'flex',
      gap: '4px',
      flexWrap: 'wrap',
    });
  }

  public setContent(tags: string[], searchedTags: string[]) {
    tags.forEach(tag => {
      const tagEl = this.container.createSpan({ text: tag });

      tagEl.setCssStyles({
        background: 'var(--tag-background)',
        color: 'var(--tag-color)',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '11px',
      });

      const isMatched = searchedTags.some(st => tag.toLowerCase() === st.toLowerCase());

      if (isMatched) {
        tagEl.setCssStyles({
          background: 'var(--interactive-accent)',
          color: 'var(--text-on-accent)',
          fontWeight: '600',
        });
      }
    });
  }
}
