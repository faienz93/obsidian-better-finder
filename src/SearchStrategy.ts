// Strategy pattern o Factory Pattern
export interface SearchStrategyInterface {
  addFilter(query: string): any;
  removeFilter(query: string): any;
}

class TagsFilter implements SearchStrategyInterface {
  /**
   * Extract tags from query (#tag, #tag-with-dash, #tag/nested)
   */
  addFilter(query: string) {
    const tagRegex = /#([a-zA-Z0-9][\w\-/]*)/g;
    const matches = query.match(tagRegex);

    return matches ? matches.map(tag => tag.toLowerCase()) : [];
  }
  /**
   * Remove tags from query string
   */
  removeFilter(query: string) {
    return query.replace(/#([a-zA-Z0-9][\w\-/]*)/g, '').trim();
  }
}

class DateFilter implements SearchStrategyInterface {
  /**
   * Extract date filter keywords
   */
  addFilter(query: string): 'today' | 'this-week' | 'this-month' | undefined {
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
  removeFilter(query: string): string {
    return query
      .replace(/\btoday\b/gi, '')
      .replace(/\bthis week\b/gi, '')
      .replace(/\bthis month\b/gi, '')
      .trim();
  }
}

// Extract file type filters (PDF, immagine, Word, Excel)
class FileFilter implements SearchStrategyInterface {
  /**
   * Extract file type filters
   * Supports: PDF, Word, Excel, immagine/image
   */
  addFilter(query: string): string[] {
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

    // Canvas files
    if (/\bcanvas\b/.test(lowerQuery)) {
      types.push('.canvas');
    }

    // JSON files
    if (/\bjson\b/.test(lowerQuery)) {
      types.push('.json');
    }

    // BASE files
    if (/\bbase\b/.test(lowerQuery)) {
      types.push('.base');
    }

    // Remove duplicates
    return [...new Set(types)];
  }

  /**
   * Remove file type keywords from query
   */
  removeFilter(query: string): string {
    return query
      .replace(/\b(immagine|image|img|png|jpg|jpeg|gif|webp)\b/gi, '')
      .replace(/\bpdf\b/gi, '')
      .replace(/\b(word|docx|doc)\b/gi, '')
      .replace(/\b(excel|xlsx|xls)\b/gi, '')
      .replace(/\bcanvas\b/gi, '')
      .replace(/\bjson\b/gi, '')
      .replace(/\bbase\b/gi, '')
      .trim();
  }
}

class ScopeFilter implements SearchStrategyInterface {
  /**
   * Extract scope filter (title:something)
   * Returns both scope and remaining text
   */
  addFilter(query: string): { scope?: 'title' | 'content', remainingText: string } {
    const titleMatch = query.match(/\btitle:\s*(\S+)/i);

    if (titleMatch) {
      const searchTerm = titleMatch[1];
      const remainingText = query.replace(/\btitle:\s*\S+/i, searchTerm).trim();

      return { scope: 'title', remainingText };
    }

    return { scope: undefined, remainingText: query };
  }

  // TODO: implementare. cosi non rispetta principio SOLID di Interface Segregation
  removeFilter(query: string) {
    // result.scope = scopeResult.scope;
    // remainingText = scopeResult.remainingText;
    throw new Error("Method not implemented.");
  }
}

class TaskFilter implements SearchStrategyInterface {
  /**
   * Extract task filter (task:, task-todo:, task-done:)
   */
  addFilter(query: string): 'all' | 'todo' | 'done' | undefined {
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
  removeFilter(query: string): string {
    return query
      .replace(/\btask-todo:\b/gi, '')
      .replace(/\btask-done:\b/gi, '')
      .replace(/\btask:\b/gi, '')
      .trim();
  }
}

// TODO questo per lo "strategy pattern" capire quale va meglio
// class SearchStrategyContext {
//   private strategy: SearchStrategyInterface;
//   public setStrategy(strategy: SearchStrategyInterface): void {
//     this.strategy = strategy;
//   }

//   public addFilter(query: string): any {
//     return this.strategy.addFilter(query);
//   }

//   public removeFilter(query: string): any {
//     return this.removeFilter(query);
//   }
// }

class SearchStrategyFactory {
  private static readonly strategyMap: Map<string, SearchStrategyInterface> = new Map();

  constructor() {
    // Da cambiare. per ora lo mantengo qui ma no dovrebbe andare nel costruttore
    // popolare la mappa statica nel costruttore non è l'ideale
    // perché verrebbe eseguito ogni volta che fai 'new'

    // Questi nomi li ho messi qui cosi, ma dovranno essere quelli degli Hints
    SearchStrategyFactory.strategyMap.set('tag', new TagsFilter());
    SearchStrategyFactory.strategyMap.set('dateFilter', new DateFilter());
    SearchStrategyFactory.strategyMap.set('fileTypes', new FileFilter());
    SearchStrategyFactory.strategyMap.set('title', new ScopeFilter());
    SearchStrategyFactory.strategyMap.set('task', new TaskFilter());
  }

  public getStrategy(strategyType: string) {
    const strategy = SearchStrategyFactory.strategyMap.get(strategyType);

    if (!strategy) {
      throw new Error(`Invalid type type: ${strategyType}`);
    }

    return strategy;
  }
}

class Main {
  public static main(args: string[]): void {
    console.log("Test!");
    console.log("Arguments:", args);
    const test: SearchStrategyFactory = new SearchStrategyFactory()

    console.log(test)
  }
}

Main.main(process.argv.slice(2));
