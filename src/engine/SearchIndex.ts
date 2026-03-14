import { App, TFile, Notice } from "obsidian";
import MiniSearch from 'minisearch';

interface IndexedDocument {
  id: string;           // file.path
  basename: string;     // file.basename (peso alto nel ranking)
  content: string;      // contenuto del file (primi N caratteri)
  mtime: number;        // per tracking modifiche
  extension: string;    // per filtri futuri
}

export class SearchIndex {
  private miniSearch: MiniSearch<IndexedDocument>;
  private app: App;
  private indexedPaths = new Set<string>();
  private isReady = false;
  private static _instance: SearchIndex | null;

  private constructor(app: App) {
    this.app = app;

    // Configurazione MiniSearch
    this.miniSearch = new MiniSearch({
      fields: ['basename', 'content'],  // Campi indicizzati per ricerca
      storeFields: ['id', 'mtime', 'extension'],  // Campi salvati per retrieval
      searchOptions: {
        boost: { basename: 5 },         // Titolo pesa 5x più del contenuto
        fuzzy: 0.2,                     // Tolleranza errori di battitura
        prefix: true,                   // "gat" trova "gatto"
        combineWith: 'AND'              // Tutte le parole devono essere presenti
      }
    });
  }

  public static getInstance(app: App): SearchIndex {
    if (!SearchIndex._instance) {
      SearchIndex._instance = new SearchIndex(app);
    }

    return SearchIndex._instance;
  }

  /**
   * Costruisce l'indice iniziale di tutti i file markdown
   * Usa batching per non bloccare l'UI
   */
  async buildIndex(): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    const BATCH_SIZE = 100; // Processa 100 file alla volta

    console.log(`[SearchIndex] Building index for ${files.length} markdown files...`);
    const startTime = Date.now();

    // Mostra notice all'utente
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

        // Aggiorna progress
        notice.setMessage(`Indexing... ${Math.min(i + BATCH_SIZE, files.length)}/${files.length}`);

        // Yield all'event loop per non bloccare UI
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

  /**
   * Indicizza un singolo file
   */
  private async indexFile(file: TFile): Promise<IndexedDocument | null> {
    if (file.extension !== 'md') return null;

    try {
      const content = await this.app.vault.cachedRead(file);

      // Limita contenuto per performance
      // Primi 10.000 caratteri sono sufficienti per la maggior parte dei casi
      const MAX_CONTENT_LENGTH = 10000;
      const truncatedContent = content.length > MAX_CONTENT_LENGTH
        ? content.slice(0, MAX_CONTENT_LENGTH)
        : content;

      const doc: IndexedDocument = {
        id: file.path,
        basename: file.basename,
        content: truncatedContent,
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

  /**
   * Ricerca full-text veloce usando l'indice
   */
  search(query: string, maxResults?: number): TFile[] {
    if (!this.isReady) {
      console.warn('[SearchIndex] Index not ready yet');

      return [];
    }

    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      const results = this.miniSearch.search(query);

      // Converti risultati in TFile oggetti
      const files: TFile[] = [];

      for (const result of (maxResults !== undefined ? results.slice(0, maxResults) : results)) {
        const file = this.app.vault.getAbstractFileByPath(result.id);

        // files[0].stat.ctime
        if (file instanceof TFile) {
          files.push(file);
        }
      }

      return files;
    } catch (error) {
      console.error('[SearchIndex] Search error:', error);

      return [];
    }
  }

  /**
   * Aggiorna un singolo file nell'indice (chiamato quando un file cambia)
   */
  async updateFile(file: TFile): Promise<void> {
    if (file.extension !== 'md') return;

    try {
      // Rimuovi vecchia versione se esiste
      if (this.indexedPaths.has(file.path)) {
        this.miniSearch.discard(file.path);
      }

      // Aggiungi nuova versione
      const doc = await this.indexFile(file);

      if (doc) {
        this.miniSearch.add(doc);
      }
    } catch (error) {
      console.error(`[SearchIndex] Error updating ${file.path}:`, error);
    }
  }

  /**
   * Rimuove un file dall'indice (chiamato quando un file viene cancellato)
   */
  removeFile(file: TFile): void {
    if (this.indexedPaths.has(file.path)) {
      this.miniSearch.discard(file.path);
      this.indexedPaths.delete(file.path);
    }
  }

  /**
   * Gestisce il rename di un file
   */
  async renameFile(file: TFile, oldPath: string): Promise<void> {
    // Rimuovi vecchio path
    if (this.indexedPaths.has(oldPath)) {
      this.miniSearch.discard(oldPath);
      this.indexedPaths.delete(oldPath);
    }

    // Aggiungi con nuovo path
    await this.updateFile(file);
  }

  /**
   * Verifica se l'indice è pronto
   */
  isIndexReady(): boolean {
    return this.isReady;
  }

  /**
   * Ottieni statistiche sull'indice
   */
  getStats(): { total: number; ready: boolean } {
    return {
      total: this.indexedPaths.size,
      ready: this.isReady
    };
  }

  /**
   * Ricostruisce l'indice da zero (per debug o reset)
   */
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
    const scoredFiles: Array<{ file: TFile; score: number }> = [];

    for (const file of files) {
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

          // Count occurrences in content
          const occurrences = (lowerContent.match(new RegExp(searchText, 'g')) || []).length;

          score += occurrences;
        } catch (error) {
          console.error(`Error reading file ${file.path}:`, error);
        }
      }

      // If there's any match, add to results
      if (score > 0) {
        scoredFiles.push({ file, score });
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
