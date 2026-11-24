import "./TagsPreview.css";

// The tag being typed at the end of the query, after its "#".
const PARTIAL_TAG = /#([a-zA-Z0-9\-/]*)$/;

export class TagsPreview {
  private container: HTMLElement;

  constructor(parentEl: HTMLElement) {
    this.container = parentEl.createDiv({ cls: 'tag-preview-panel' });
  }

  public updateTagPreview(allTagsMap: Record<string, number>, inputEl: HTMLInputElement): void {
    const value = inputEl.value;
    const partialTagMatch = value.match(PARTIAL_TAG);

    if (!partialTagMatch) {
      this.hide();

      return;
    }

    const partialTag = partialTagMatch[1].toLowerCase();
    let tags = Object.keys(allTagsMap);

    if (partialTag) {
      tags = tags.filter(tag => tag.toLowerCase().slice(1).startsWith(partialTag));
    }

    tags.sort((a, b) => (allTagsMap[b] || 0) - (allTagsMap[a] || 0));
    tags = tags.slice(0, 20);

    if (tags.length === 0) {
      this.hide();

      return;
    }

    this.container.empty();
    this.container.addClass('tag-preview-panel--visible');

    tags.forEach(tag => {
      const chip = this.container.createSpan({ cls: 'tag-preview-chip', text: tag });

      chip.addEventListener('click', () => {
        inputEl.value = value.replace(PARTIAL_TAG, `${tag} `);
        inputEl.focus();
        inputEl.dispatchEvent(new Event('input'));
      });
    });
  }

  private hide(): void {
    this.container.empty();
    this.container.removeClass('tag-preview-panel--visible');
  }
}
