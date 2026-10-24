import "./Tags.css";

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
      const isMatched = searchedTags.includes(tag);

      this.container.createSpan({ text: tag, cls: isMatched ? 'finder-tag finder-tag-searched' : 'finder-tag' });
    });
  }
}
