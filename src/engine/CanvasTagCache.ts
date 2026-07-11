import { App, TFile } from "obsidian";

interface CanvasTagEntry {
  mtime: number;
  tags: string[];
}

/**
 * Cache dei tag contenuti nei nodi testo dei file .canvas.
 * I canvas non passano dal metadataCache di Obsidian, quindi i tag vanno
 * estratti dal JSON: la cache rende la lookup sincrona per TagsFilter.
 * Popolata all'avvio (main.ts) e tenuta viva dagli eventi vault.
 */
export class CanvasTagCache {
  private static _instance: CanvasTagCache | null;
  private app: App;
  private cache = new Map<string, CanvasTagEntry>();

  private constructor(app: App) {
    this.app = app;
  }

  public static getInstance(app: App): CanvasTagCache {
    if (!CanvasTagCache._instance) {
      CanvasTagCache._instance = new CanvasTagCache(app);
    }

    return CanvasTagCache._instance;
  }

  async buildCache(): Promise<void> {
    const canvases = this.app.vault.getFiles().filter(f => f.extension === 'canvas');

    for (const file of canvases) {
      await this.updateFile(file);
    }
  }

  async updateFile(file: TFile): Promise<void> {
    if (file.extension !== 'canvas') return;

    try {
      const content = await this.app.vault.cachedRead(file);

      this.cache.set(file.path, { mtime: file.stat.mtime, tags: this.extractTags(content) });
    } catch (error) {
      console.error(`[CanvasTagCache] Error reading ${file.path}:`, error);
      this.cache.delete(file.path);
    }
  }

  removeFile(path: string): void {
    this.cache.delete(path);
  }

  async renameFile(file: TFile, oldPath: string): Promise<void> {
    this.cache.delete(oldPath);
    await this.updateFile(file);
  }

  /**
   * Tag del canvas, lookup sincrona. Se la voce è stantia (mtime cambiato)
   * parte un refresh in background: la ricerca successiva vede i tag aggiornati.
   */
  getTags(file: TFile): string[] {
    const entry = this.cache.get(file.path);

    if (!entry || entry.mtime !== file.stat.mtime) {
      void this.updateFile(file);

      return entry?.tags ?? [];
    }

    return entry.tags;
  }

  private extractTags(content: string): string[] {
    try {
      const data = JSON.parse(content);
      const tags = new Set<string>();

      for (const node of data?.nodes ?? []) {
        if (typeof node?.text === 'string') {
          for (const match of node.text.match(/#([a-zA-Z0-9][\w\-/]*)/g) ?? []) {
            tags.add(match.toLowerCase());
          }
        }
      }

      return [...tags];
    } catch {
      return [];
    }
  }
}
