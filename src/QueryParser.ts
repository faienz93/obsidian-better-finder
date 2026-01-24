

export interface ParsedQuery {
  // Input originale
  rawInput: string;

  // Modalità
  isCommandMode: boolean;
  commandText?: string;

  // Filtri
  tags: string[];
  dateFilter?: 'today' | 'this-week' | 'this-month';
  fileTypes: string[];
  scope?: 'title' | 'content';
  taskFilter?: 'all' | 'todo' | 'done';

  // Testo libero (dopo aver rimosso tutti i filtri speciali)
  freeText: string;
}

export class QueryParser {

  /**
   * Parse user input and extract all filters
   * @param input - Raw search query from user
   * @returns ParsedQuery object with all extracted filters
   */
  static parse(input: string): ParsedQuery {
    const trimmedInput = input.trim();

    // Initialize result
    const result: ParsedQuery = {
      rawInput: trimmedInput,
      isCommandMode: false,
      tags: [],
      fileTypes: [],
      freeText: ''
    };

    // Check for command mode (starts with >)
    if (trimmedInput.startsWith('>')) {
      result.isCommandMode = true;
      result.commandText = trimmedInput.slice(1).trim();
      return result;
    }

    // Extract all patterns
    let remainingText = trimmedInput;

    // 1. Extract tags (#react #css)
    result.tags = this.extractTags(remainingText);
    remainingText = this.removeTags(remainingText);

    // 2. Extract date filters (today, this week, this month)
    result.dateFilter = this.extractDateFilter(remainingText);
    remainingText = this.removeDateFilter(remainingText);

    // 3. Extract file type filters (PDF, immagine, Word, Excel)
    result.fileTypes = this.extractFileTypes(remainingText);
    remainingText = this.removeFileTypes(remainingText);

    // 4. Extract scope (title:something)
    const scopeResult = this.extractScope(remainingText);
    result.scope = scopeResult.scope;
    remainingText = scopeResult.remainingText;

    // 5. Extract task filters (task:, task-todo:, task-done:)
    result.taskFilter = this.extractTaskFilter(remainingText);
    remainingText = this.removeTaskFilter(remainingText);

    // 6. What's left is free text
    result.freeText = remainingText.trim();

    return result;
  }

  /**
   * Extract tags from query (#tag, #tag-with-dash, #tag/nested)
   */
  private static extractTags(query: string): string[] {
    const tagRegex = /#([a-zA-Z0-9][\w\-\/]*)/g;
    const matches = query.match(tagRegex);
    return matches ? matches.map(tag => tag.toLowerCase()) : [];
  }

  /**
   * Remove tags from query string
   */
  private static removeTags(query: string): string {
    return query.replace(/#([a-zA-Z0-9][\w\-\/]*)/g, '').trim();
  }

  /**
   * Extract date filter keywords
   */
  private static extractDateFilter(query: string): 'today' | 'this-week' | 'this-month' | undefined {
    const lowerQuery = query.toLowerCase();

    // Check for exact matches (word boundaries)
    if (/\btoday\b/.test(lowerQuery)) {
      return 'today';
    }
    if (/\bthis week\b/.test(lowerQuery)) {
      return 'this-week';
    }
    if (/\bthis month\b/.test(lowerQuery)) {
      return 'this-month';
    }

    return undefined;
  }

  /**
   * Remove date filter keywords from query
   */
  private static removeDateFilter(query: string): string {
    return query
      .replace(/\btoday\b/gi, '')
      .replace(/\bthis week\b/gi, '')
      .replace(/\bthis month\b/gi, '')
      .trim();
  }

  /**
   * Extract file type filters
   * Supports: PDF, Word, Excel, immagine/image
   */
  private static extractFileTypes(query: string): string[] {
    const types: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Image patterns
    if (/\b(immagine|image|img|png|jpg|jpeg|gif|webp)\b/.test(lowerQuery)) {
      types.push('.png', '.jpg', '.jpeg', '.gif', '.webp');
    }

    // PDF
    if (/\bpdf\b/.test(lowerQuery)) {
      types.push('.pdf');
    }

    // Word documents
    if (/\b(word|docx|doc)\b/.test(lowerQuery)) {
      types.push('.docx', '.doc');
    }

    // Excel spreadsheets
    if (/\b(excel|xlsx|xls)\b/.test(lowerQuery)) {
      types.push('.xlsx', '.xls');
    }

    // Remove duplicates
    return [...new Set(types)];
  }

  /**
   * Remove file type keywords from query
   */
  private static removeFileTypes(query: string): string {
    return query
      .replace(/\b(immagine|image|img|png|jpg|jpeg|gif|webp)\b/gi, '')
      .replace(/\bpdf\b/gi, '')
      .replace(/\b(word|docx|doc)\b/gi, '')
      .replace(/\b(excel|xlsx|xls)\b/gi, '')
      .trim();
  }

  /**
   * Extract scope filter (title:something)
   * Returns both scope and remaining text
   */
  private static extractScope(query: string): { scope?: 'title' | 'content', remainingText: string } {
    const titleMatch = query.match(/\btitle:\s*(\S+)/i);

    if (titleMatch) {
      const searchTerm = titleMatch[1];
      const remainingText = query.replace(/\btitle:\s*\S+/i, searchTerm).trim();
      return { scope: 'title', remainingText };
    }

    return { scope: undefined, remainingText: query };
  }

  /**
   * Extract task filter (task:, task-todo:, task-done:)
   */
  private static extractTaskFilter(query: string): 'all' | 'todo' | 'done' | undefined {
    const lowerQuery = query.toLowerCase();

    if (/\btask-todo:\b/.test(lowerQuery)) {
      return 'todo';
    }
    if (/\btask-done:\b/.test(lowerQuery)) {
      return 'done';
    }
    if (/\btask:\b/.test(lowerQuery)) {
      return 'all';
    }

    return undefined;
  }

  /**
   * Remove task filter keywords from query
   */
  private static removeTaskFilter(query: string): string {
    return query
      .replace(/\btask-todo:\b/gi, '')
      .replace(/\btask-done:\b/gi, '')
      .replace(/\btask:\b/gi, '')
      .trim();
  }

  /**
   * Helper: Check if a date is today
   */
  static isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  }

  /**
   * Helper: Check if a date is in this week
   */
  static isThisWeek(date: Date): boolean {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return date >= weekStart && date < weekEnd;
  }

  /**
   * Helper: Check if a date is in this month
   */
  static isThisMonth(date: Date): boolean {
    const today = new Date();
    return date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  }
}
