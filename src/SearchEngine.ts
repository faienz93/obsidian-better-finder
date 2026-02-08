import { App, TFile } from "obsidian";
import { ParsedQuery } from "./QueryParser";

export class SearchEngine {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Search files using simple text matching
   * Returns files sorted by relevance
   */
  async searchFiles(parsed: ParsedQuery, files: TFile[]): Promise<TFile[]> {
    // If no free text, return files as-is
    if (!parsed.freeText) {
      return files;
    }

    const searchText = parsed.freeText.toLowerCase();
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
  searchInTitles(searchText: string, files: TFile[]): TFile[] {
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
