import { SearchStrategyFactory } from "./SearchStrategy";

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

    const factory = SearchStrategyFactory.getInstance();
    let remainingText = trimmedInput;

    // 1. Extract tags (#react #css)
    result.tags = factory.getStrategy('tag').extract(remainingText) as string[];
    remainingText = factory.getStrategy('tag').removeFrom(remainingText);

    // 2. Extract date filters (today, this week, this month)
    result.dateFilter = factory.getStrategy('dateFilter').extract(remainingText) as ParsedQuery['dateFilter'];
    remainingText = factory.getStrategy('dateFilter').removeFrom(remainingText);

    // 3. Extract file type filters (PDF, immagine, Word, Excel)
    result.fileTypes = factory.getStrategy('fileTypes').extract(remainingText) as string[];
    remainingText = factory.getStrategy('fileTypes').removeFrom(remainingText);

    // 4. Extract scope (title:something)
    const scopeResult = factory.getStrategy('title').extract(remainingText) as { scope?: 'title' | 'content'; remainingText: string };

    result.scope = scopeResult.scope;
    remainingText = scopeResult.remainingText;

    // 5. Extract task filters (task:, task-todo:, task-done:)
    result.taskFilter = factory.getStrategy('task').extract(remainingText) as ParsedQuery['taskFilter'];
    remainingText = factory.getStrategy('task').removeFrom(remainingText);

    // 6. What's left is free text
    result.freeText = remainingText.trim();

    return result;
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
