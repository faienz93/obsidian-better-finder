export class TaskBadge {
  private badge: HTMLElement;

  constructor(parentEl: HTMLElement) {
    this.badge = parentEl.createDiv();
    this.badge.setCssStyles({
      marginTop: '6px',
      fontSize: '11px',
      color: 'var(--text-muted)',
    });
  }

  public setContent(done: number, total: number) {
    this.badge.setText(`✓ ${done}/${total} tasks completed`);
  }
}
