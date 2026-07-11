import { execFile } from "child_process";
import { App, FileSystemAdapter, TFile } from "obsidian";
import { SearchIndex } from "./SearchIndex";

// Estensioni gestite dall'extractor: PDF (testo nativo) e immagini (OCR)
const PDF_EXTENSIONS = ['pdf'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

export const XBERG_EXTENSIONS = [...PDF_EXTENSIONS, ...IMAGE_EXTENSIONS];

// Il progetto è in transizione kreuzberg→xberg: proviamo entrambi i nomi.
const BINARY_CANDIDATES = ['xberg', 'kreuzberg'];

const EXTRACT_TIMEOUT_MS = 60_000;
const MAX_TEXT_LENGTH = 10_000;

// Cache persistente (path relativo alla root del vault)
const CACHE_PATH = '.obsidian/plugins/obsidian-better-finder/xberg-cache.json';

interface CacheEntry {
  mtime: number;
  text: string;
}

/**
 * Estrazione contenuti via CLI Xberg (sidecar): testo dai PDF, OCR dalle immagini.
 * Il testo estratto entra nell'indice MiniSearch come documento esterno.
 * Se il binario non è installato il plugin degrada con grazia (nessuna estrazione).
 */
export class XbergExtractor {
  private static _instance: XbergExtractor | null;
  private app: App;
  private binary: string | null | undefined; // undefined = non ancora rilevato
  private cache = new Map<string, CacheEntry>();
  private saveTimer: number | null = null;

  private constructor(app: App) {
    this.app = app;
  }

  public static getInstance(app: App): XbergExtractor {
    if (!XbergExtractor._instance) {
      XbergExtractor._instance = new XbergExtractor(app);
    }

    return XbergExtractor._instance;
  }

  /** Rileva il binario CLI (una volta sola). null = non disponibile. */
  async detectBinary(): Promise<string | null> {
    if (this.binary !== undefined) return this.binary;

    for (const candidate of BINARY_CANDIDATES) {
      const ok = await new Promise<boolean>((resolve) => {
        execFile(candidate, ['--version'], { timeout: 5_000 }, (error) => resolve(!error));
      });

      if (ok) {
        this.binary = candidate;
        console.log(`[XbergExtractor] Found binary: ${candidate}`);

        return candidate;
      }
    }

    this.binary = null;
    console.log('[XbergExtractor] No xberg/kreuzberg binary found — PDF/OCR indexing disabled');

    return null;
  }

  /**
   * Indicizza tutti i PDF/immagini del vault (lazy, in background).
   * Da chiamare dopo il build dell'indice markdown.
   */
  async indexAll(): Promise<void> {
    const binary = await this.detectBinary();

    if (!binary) return;

    await this.loadCache();

    const files = this.app.vault.getFiles().filter(f => XBERG_EXTENSIONS.includes(f.extension.toLowerCase()));
    const searchIndex = SearchIndex.getInstance(this.app);

    for (const file of files) {
      const text = await this.extractText(file);

      if (text) {
        searchIndex.addExternalDocument(file, text);
      }
    }

    this.scheduleSaveCache();
    console.log(`[XbergExtractor] Indexed ${files.length} PDF/image files`);
  }

  /** (Re)indicizza un singolo file, chiamato dagli eventi vault. */
  async indexFile(file: TFile): Promise<void> {
    if (!XBERG_EXTENSIONS.includes(file.extension.toLowerCase())) return;

    const binary = await this.detectBinary();

    if (!binary) return;

    const text = await this.extractText(file);

    if (text) {
      SearchIndex.getInstance(this.app).addExternalDocument(file, text);
      this.scheduleSaveCache();
    }
  }

  /** Estrae il testo (con cache su mtime: nessuna riestrazione se il file non è cambiato). */
  private async extractText(file: TFile): Promise<string | null> {
    const cached = this.cache.get(file.path);

    if (cached && cached.mtime === file.stat.mtime) return cached.text;

    const fullPath = this.getFullPath(file);

    if (!fullPath || !this.binary) return null;

    const text = await new Promise<string | null>((resolve) => {
      // NOTA: flag CLI da riconfermare sulla doc Xberg al primo utilizzo reale
      // (progetto in transizione kreuzberg→xberg)
      execFile(this.binary as string, ['extract', fullPath, '--format', 'json'],
        { timeout: EXTRACT_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
        (error, stdout) => {
          if (error) {
            console.error(`[XbergExtractor] Extraction failed for ${file.path}:`, error.message);
            resolve(null);

            return;
          }

          resolve(this.parseOutput(stdout));
        });
    });

    if (text) {
      this.cache.set(file.path, { mtime: file.stat.mtime, text });
    }

    return text;
  }

  /** Output JSON se possibile (campo text/content), altrimenti stdout grezzo. */
  private parseOutput(stdout: string): string | null {
    const raw = stdout.trim();

    if (!raw) return null;

    try {
      const json = JSON.parse(raw);
      const text = json.text ?? json.content ?? null;

      return typeof text === 'string' && text.trim() ? text.slice(0, MAX_TEXT_LENGTH) : null;
    } catch {
      return raw.slice(0, MAX_TEXT_LENGTH);
    }
  }

  private getFullPath(file: TFile): string | null {
    const adapter = this.app.vault.adapter;

    return adapter instanceof FileSystemAdapter ? adapter.getFullPath(file.path) : null;
  }

  private async loadCache(): Promise<void> {
    try {
      if (await this.app.vault.adapter.exists(CACHE_PATH)) {
        const raw = await this.app.vault.adapter.read(CACHE_PATH);

        this.cache = new Map(Object.entries(JSON.parse(raw)));
      }
    } catch (error) {
      console.error('[XbergExtractor] Failed to load cache:', error);
      this.cache = new Map();
    }
  }

  private scheduleSaveCache(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);

    this.saveTimer = window.setTimeout(async () => {
      this.saveTimer = null;

      try {
        await this.app.vault.adapter.write(CACHE_PATH, JSON.stringify(Object.fromEntries(this.cache)));
      } catch (error) {
        console.error('[XbergExtractor] Failed to save cache:', error);
      }
    }, 2_000);
  }
}
