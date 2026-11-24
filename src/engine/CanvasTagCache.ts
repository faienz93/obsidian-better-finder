import { App, TFile } from "obsidian";
import { CommonCache } from "./CommonCache";

interface CanvasTagEntry {
  mtime: number;
  tags: string[];
}

/**
 * Tags found in the text nodes of .canvas files. Canvases never reach Obsidian's metadataCache,
 * so the tags are read from the JSON; the cache makes the lookup synchronous for TagsFilter.
 * Built at startup (main.ts) and kept current by vault events.
 */
export class CanvasTagCache implements CommonCache {
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

  // --- CommonCache ---

  handles(file: TFile): boolean {
    return file.extension === 'canvas';
  }

  async onCreate(file: TFile): Promise<void> {
    await this.updateFile(file);
  }

  async onUpdate(file: TFile): Promise<void> {
    await this.updateFile(file);
  }

  async onDelete(file: TFile): Promise<void> {
    this.cache.delete(file.path);
  }

  /** Same canvas: move the tags to the new path instead of re-reading it. */
  async onRename(file: TFile, oldPath: string): Promise<void> {
    const entry = this.cache.get(oldPath);

    this.cache.delete(oldPath);

    if (entry) {
      this.cache.set(file.path, entry);

      return;
    }

    await this.updateFile(file);
  }

  /**
   * The canvas tags, synchronously. A stale entry (mtime changed) starts a background refresh,
   * so the next search sees the new tags.
   */
  getTags(file: TFile): string[] {
    const entry = this.cache.get(file.path);

    if (!entry || entry.mtime !== file.stat.mtime) {
      this.updateFile(file).catch(console.error);

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
            tags.add(match);
          }
        }
      }

      return [...tags];
    } catch {
      return [];
    }
  }
}
