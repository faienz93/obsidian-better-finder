/** One IntersectionObserver per view: runs a callback the first time a watched element is visible. */
export class VisibilityWatcher {
  private observer: IntersectionObserver | null = null;
  private callbacks = new WeakMap<Element, () => void>();

  public watch(el: HTMLElement, onVisible: () => void): void {
    this.callbacks.set(el, onVisible);
    this.getObserver().observe(el);
  }

  /** Forgets every watched element: call it before the view draws a new set of results, and on close. */
  public reset(): void {
    this.observer?.disconnect();
    this.callbacks = new WeakMap();
  }

  private getObserver(): IntersectionObserver {
    if (!this.observer) {
      this.observer = new IntersectionObserver((entries) => this.onIntersection(entries));
    }

    return this.observer;
  }

  private onIntersection(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;

      const onVisible = this.callbacks.get(entry.target);

      this.observer?.unobserve(entry.target);
      this.callbacks.delete(entry.target);
      onVisible?.();
    }
  }
}
