import { execFile } from "child_process";
import { App, FileSystemAdapter, TFile } from "obsidian";
import { SearchIndex } from "./SearchIndex";
import { CommonCache } from "./CommonCache";

// Estensioni gestite dall'extractor: PDF (testo nativo), immagini (OCR), office
const PDF_EXTENSIONS = ['pdf'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const OFFICE_EXTENSIONS = ['docx', 'xlsx'];

export const XBERG_EXTENSIONS = [...PDF_EXTENSIONS, ...IMAGE_EXTENSIONS, ...OFFICE_EXTENSIONS];

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
export class XbergExtractor implements CommonCache {
  private static _instance: XbergExtractor | null;
  private app: App;
  private binary: string | null | undefined; // undefined = non ancora rilevato
  private cache = new Map<string, CacheEntry>();
  // In-flight extractions by path: saving a file twice in a row must not spawn
  // two OCR processes (the mtime cache only helps once the first one is done).
  private inFlight = new Map<string, Promise<string | null>>();
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

  // --- CommonCache ---

  /** Extraction takes up to 60s: it must not block the event handler. */
  readonly deferred = true;

  handles(file: TFile): boolean {
    return XBERG_EXTENSIONS.includes(file.extension.toLowerCase());
  }

  async onCreate(file: TFile): Promise<void> {
    await this.indexFile(file);
  }

  async onUpdate(file: TFile): Promise<void> {
    await this.indexFile(file);
  }

  /**
   * Drops the extracted text. Without this the entry was orphaned in
   * xberg-cache.json, which grew without bound. The index cleans up its own
   * copy: main.ts notifies every cache.
   */
  async onDelete(file: TFile): Promise<void> {
    if (!this.handles(file)) return;

    if (this.cache.delete(file.path)) {
      this.scheduleSaveCache();
    }
  }

  /**
   * Same file: move the entry to the new path instead of re-extracting. The
   * cache is keyed by path, so the new name used to miss and restart the OCR
   * from scratch — up to 60s for an unchanged file.
   */
  async onRename(file: TFile, oldPath: string): Promise<void> {
    if (!this.handles(file)) return;

    const entry = this.cache.get(oldPath);

    if (!entry) {
      await this.indexFile(file);

      return;
    }

    this.cache.delete(oldPath);
    this.cache.set(file.path, entry);
    this.scheduleSaveCache();
    // The index discarded the document under the old path: re-add it with the
    // text we already hold, without going through the sidecar.
    SearchIndex.getInstance(this.app).addExternalDocument(file, entry.text);
  }

  /**
   * Testo estratto di un file (per preview testuali).
   * null se il binario manca o l'estensione non è supportata.
   */
  async getText(file: TFile): Promise<string | null> {
    if (!XBERG_EXTENSIONS.includes(file.extension.toLowerCase())) return null;

    const binary = await this.detectBinary();

    if (!binary) return null;

    const text = await this.extractText(file);

    if (text) this.scheduleSaveCache();

    return text;
  }

  /** Extracts the text: mtime cache plus dedup of concurrent extractions. */
  private async extractText(file: TFile): Promise<string | null> {
    const cached = this.cache.get(file.path);

    if (cached && cached.mtime === file.stat.mtime) return cached.text;

    const running = this.inFlight.get(file.path);

    if (running) return running;

    const extraction = this.runExtraction(file).finally(() => {
      this.inFlight.delete(file.path);
    });

    this.inFlight.set(file.path, extraction);

    return extraction;
  }

  private async runExtraction(file: TFile): Promise<string | null> {
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
