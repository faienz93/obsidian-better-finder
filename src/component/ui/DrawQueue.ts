interface Draw {
  run: () => Promise<void>;
  isWanted: () => boolean;
  resolve: () => void;
  reject: (error: unknown) => void;
}

/**
 * Runs costly draws one at a time, latest request first: while the user scrolls, what has just
 * come into view is drawn before what was asked for earlier. A draw nobody wants any more (its
 * element left the page) is skipped, and its promise still resolves.
 */
export class DrawQueue {
  private readonly pending: Draw[] = [];
  private running = false;

  add(run: () => Promise<void>, isWanted: () => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pending.push({ run, isWanted, resolve, reject });
      this.pump().catch(console.error);
    });
  }

  private async pump(): Promise<void> {
    if (this.running) return;

    this.running = true;

    try {
      for (let draw = this.pending.pop(); draw; draw = this.pending.pop()) {
        if (!draw.isWanted()) {
          draw.resolve();
          continue;
        }

        try {
          await draw.run();
          draw.resolve();
        } catch (error) {
          draw.reject(error);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
