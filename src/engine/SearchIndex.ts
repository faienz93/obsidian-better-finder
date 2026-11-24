import { App, TFile, Notice } from "obsidian";
import MiniSearch from 'minisearch';
import { CommonCache } from "./CommonCache";
import { escapeRegExp } from "./escapeRegExp";

// The first 10 000 characters are enough to find most notes, and keep indexing fast.
const MAX_CONTENT_LENGTH = 10000;

interface IndexedDocument {
  id: string;           // file.path
  basename: string;     // file.basename (weighted high in the ranking)
  content: string;      // file content (first MAX_CONTENT_LENGTH characters)
  mtime: number;        // to track changes
  extension: string;    // for future filters
}

/** A file the Index found, with the document terms MiniSearch matched in it. */
export interface IndexResult {
  file: TFile;
  terms: string[];
}

export class SearchIndex implements CommonCache {
  private miniSearch: MiniSearch<IndexedDocument>;
  private app: App;
  private indexedPaths = new Set<string>();
  private isReady = false;
  private static _instance: SearchIndex | null;

  private constructor(app: App) {
    this.app = app;

    this.miniSearch = new MiniSearch({
      fields: ['basename', 'content'],
      storeFields: ['id', 'mtime', 'extension'],
      searchOptions: {
        boost: { basename: 5 },         // The title weighs 5x the content
        // Fuzzy only on long terms: on short words it gives false positives
        // ("Bacca" → "becca"). See bug B1.
        fuzzy: (term) => term.length >= 6 ? 0.2 : false,
        // Prefix only on the last token: the user is still typing it; the
        // previous ones are complete words.
        prefix: (term, index, terms) => index === terms.length - 1,
        combineWith: 'AND'              // Every word must be present
      }
    });
  }

  public static getInstance(app: App): SearchIndex {
    if (!SearchIndex._instance) {
      SearchIndex._instance = new SearchIndex(app);
    }

    return SearchIndex._instance;
  }

  /** Builds the initial index of every markdown file, in batches so the UI is not blocked. */
  async buildIndex(): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    const BATCH_SIZE = 100;

    console.log(`[SearchIndex] Building index for ${files.length} markdown files...`);
    const startTime = Date.now();

    const notice = new Notice(`Indexing ${files.length} files...`, 0);

    try {
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const docs: IndexedDocument[] = [];

        for (const file of batch) {
          try {
            const doc = await this.indexFile(file);

            if (doc) docs.push(doc);
          } catch (error) {
            console.error(`[SearchIndex] Error indexing ${file.path}:`, error);
          }
        }

        if (docs.length > 0) {
          this.miniSearch.addAll(docs);
        }

        notice.setMessage(`Indexing... ${Math.min(i + BATCH_SIZE, files.length)}/${files.length}`);

        // Yield to the event loop so the UI stays responsive.
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      this.isReady = true;
      const elapsed = Date.now() - startTime;

      console.log(`[SearchIndex] Index built in ${elapsed}ms`);

      notice.hide();
      new Notice(`Index ready! (${files.length} files in ${(elapsed / 1000).toFixed(1)}s)`);
    } catch (error) {
      console.error('[SearchIndex] Build failed:', error);
      notice.hide();
      new Notice('Failed to build search index');
      throw error;
    }
  }

  private async indexFile(file: TFile): Promise<IndexedDocument | null> {
    if (file.extension !== 'md') return null;

    try {
      const content = await this.app.vault.cachedRead(file);
      const doc: IndexedDocument = {
        id: file.path,
        basename: file.basename,
        content: content.slice(0, MAX_CONTENT_LENGTH),
        mtime: file.stat.mtime,
        extension: file.extension
      };

      this.indexedPaths.add(file.path);

      return doc;
    } catch (error) {
      console.error(`[SearchIndex] Error reading ${file.path}:`, error);

      return null;
    }
  }

  /** Fast full-text search through the index. */
  search(query: string, maxResults?: number): IndexResult[] {
    if (!this.isReady) {
      console.warn('[SearchIndex] Index not ready yet');

      return [];
    }

    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      const results = this.miniSearch.search(query);

      // MiniSearch reports terms as they appear in the document, so fuzzy and prefix matches give the full word.
      const indexResults: IndexResult[] = [];

      for (const result of results.slice(0, maxResults)) {
        const file = this.app.vault.getAbstractFileByPath(result.id);

        if (file instanceof TFile) {
          indexResults.push({ file, terms: result.terms });
        }
      }

      return indexResults;
    } catch (error) {
      console.error('[SearchIndex] Search error:', error);

      return [];
    }
  }

  /** Re-indexes one file when it changes. */
  async updateFile(file: TFile): Promise<void> {
    if (file.extension !== 'md') return;

    try {
      if (this.indexedPaths.has(file.path)) {
        this.miniSearch.discard(file.path);
      }

      const doc = await this.indexFile(file);

      if (doc) {
        this.miniSearch.add(doc);
      }
    } catch (error) {
      console.error(`[SearchIndex] Error updating ${file.path}:`, error);
    }
  }

  /** Adds or replaces a document whose text was extracted elsewhere (PDF or image OCR via XbergExtractor). */
  addExternalDocument(file: TFile, text: string): void {
    this.discardPath(file.path);
    this.miniSearch.add({
      id: file.path,
      basename: file.basename,
      content: text,
      mtime: file.stat.mtime,
      extension: file.extension
    });
    this.indexedPaths.add(file.path);
  }

  /** Removes a deleted file from the index. */
  removeFile(file: TFile): void {
    this.discardPath(file.path);
  }

  async renameFile(file: TFile, oldPath: string): Promise<void> {
    this.discardPath(oldPath);
    await this.updateFile(file);
  }

  // --- CommonCache ---

  /**
   * The index holds markdown plus the external documents other caches hand it
   * (PDF, OCR), so on delete and rename it must also clean up the non-markdown
   * paths it indexed.
   */
  handles(file: TFile, oldPath?: string): boolean {
    if (file.extension === 'md') return true;

    // On rename the new path is not indexed yet: the old one is what tells us
    // the file is ours.
    return this.indexedPaths.has(oldPath ?? file.path);
  }

  async onCreate(file: TFile): Promise<void> {
    await this.updateFile(file);
  }

  async onUpdate(file: TFile): Promise<void> {
    await this.updateFile(file);
  }

  async onDelete(file: TFile): Promise<void> {
    this.removeFile(file);
  }

  /**
   * Markdown is re-read; external documents are only dropped from the old path,
   * because their text lives in the cache that produced it, which re-adds them.
   */
  async onRename(file: TFile, oldPath: string): Promise<void> {
    if (file.extension === 'md') {
      await this.renameFile(file, oldPath);

      return;
    }

    this.discardPath(oldPath);
  }

  private discardPath(path: string): void {
    if (this.indexedPaths.has(path)) {
      this.miniSearch.discard(path);
      this.indexedPaths.delete(path);
    }
  }

  isIndexReady(): boolean {
    return this.isReady;
  }

  getStats(): { total: number; ready: boolean } {
    return {
      total: this.indexedPaths.size,
      ready: this.isReady
    };
  }

  /** Rebuilds the index from scratch, for debugging or a reset. */
  async rebuild(): Promise<void> {
    this.miniSearch.removeAll();
    this.indexedPaths.clear();
    this.isReady = false;
    await this.buildIndex();
  }

  /**
   * Search files using simple text matching
   * Returns files sorted by relevance
   */
  async searchFilesWithoutIndex(freeText: string, files: TFile[]): Promise<TFile[]> {
    // If no free text, return files as-is
    if (!freeText) {
      return files;
    }

    const searchText = freeText.toLowerCase();
    // Escaped, or terms with metacharacters (c++, report(2024), 3.5) either break the regex,
    // losing the content match silently, or act as wildcards.
    const escaped = escapeRegExp(searchText);
    const contentRegex = new RegExp(escaped, 'g');

    // Reads files in parallel batches: one at a time blocked the search on large vaults.
    const BATCH_SIZE = 50;
    const scoredFiles: Array<{ file: TFile; score: number }> = [];

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);

      const scored = await Promise.all(batch.map(async (file) => {
        let score = 0;

        // Search in file name (basename) - higher weight
        if (file.basename.toLowerCase().includes(searchText)) {
          score += 10;
        }

        // For markdown files, search in content
        if (file.extension === 'md') {
          try {
            const content = await this.app.vault.cachedRead(file);
            const lowerContent = content.toLowerCase();
            const occurrences = (lowerContent.match(contentRegex) || []).length;

            score += occurrences;
          } catch (error) {
            console.error(`Error reading file ${file.path}:`, error);
          }
        }

        return { file, score };
      }));

      for (const sf of scored) {
        if (sf.score > 0) {
          scoredFiles.push(sf);
        }
      }
    }

    // Sort by score (highest first)
    scoredFiles.sort((a, b) => b.score - a.score);

    return scoredFiles.map(sf => sf.file);
  }

  /**
   * Search only in file names
   */
  searchInTitlesWithoutIndex(searchText: string, files: TFile[]): TFile[] {
    const lowerSearch = searchText.toLowerCase();
    const scoredFiles: Array<{ file: TFile; score: number }> = [];

    for (const file of files) {
      const basename = file.basename.toLowerCase();

      if (basename.includes(lowerSearch)) {
        // Simple scoring: exact match = higher score
        const score = basename === lowerSearch ? 100 : 10;

        scoredFiles.push({ file, score });
      }
    }

    // Sort by score
    scoredFiles.sort((a, b) => b.score - a.score);

    return scoredFiles.map(sf => sf.file);
  }
}
