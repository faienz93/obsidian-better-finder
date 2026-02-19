import { i18n } from './const';

export interface SearchStrategyInterface<TResult> {
  extract(query: string): TResult;
  removeFrom(query: string): string;
  getHints(): { label: string; desc: string }[];
}

class TagsFilter implements SearchStrategyInterface<string[]> {
  getHints() {
    return [{ label: '#tag', desc: 'tag' }];
  }

  extract(query: string) {
    const tagRegex = /#([a-zA-Z0-9][\w\-/]*)/g;
    const matches = query.match(tagRegex);

    return matches ? matches.map(tag => tag.toLowerCase()) : [];
  }

  removeFrom(query: string) {
    return query.replace(/#([a-zA-Z0-9][\w\-/]*)/g, '').trim();
  }
}

class DateFilter implements SearchStrategyInterface<'today' | 'this-week' | 'this-month' | undefined> {
  getHints() {
    return [
      { label: 'today', desc: i18n.today },
      { label: 'this week', desc: i18n.thisWeek },
      { label: 'this month', desc: i18n.thisMonth },
    ];
  }

  extract(query: string): 'today' | 'this-week' | 'this-month' | undefined {
    const lowerQuery = query.toLowerCase();

    if (/\btoday\b/.test(lowerQuery)) return 'today';
    if (/\bthis week\b/.test(lowerQuery)) return 'this-week';
    if (/\bthis month\b/.test(lowerQuery)) return 'this-month';

    return undefined;
  }

  removeFrom(query: string): string {
    return query
      .replace(/\btoday\b/gi, '')
      .replace(/\bthis week\b/gi, '')
      .replace(/\bthis month\b/gi, '')
      .trim();
  }
}

class FileFilter implements SearchStrategyInterface<string[]> {
  getHints() {
    return [
      { label: 'pdf', desc: 'PDF' },
      { label: 'image', desc: i18n.images },
      { label: 'canvas', desc: 'canvas' },
      { label: 'json', desc: 'json' },
      { label: 'base', desc: 'base' },
    ];
  }

  extract(query: string): string[] {
    const types: string[] = [];
    const lowerQuery = query.toLowerCase();

    if (/\b(immagine|image|img|png|jpg|jpeg|gif|webp)\b/.test(lowerQuery)) {
      types.push('.png', '.jpg', '.jpeg', '.gif', '.webp');
    }

    if (/\bpdf\b/.test(lowerQuery)) types.push('.pdf');
    if (/\b(word|docx|doc)\b/.test(lowerQuery)) types.push('.docx', '.doc');
    if (/\b(excel|xlsx|xls)\b/.test(lowerQuery)) types.push('.xlsx', '.xls');
    if (/\bcanvas\b/.test(lowerQuery)) types.push('.canvas');
    if (/\bjson\b/.test(lowerQuery)) types.push('.json');
    if (/\bbase\b/.test(lowerQuery)) types.push('.base');

    return [...new Set(types)];
  }

  removeFrom(query: string): string {
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

// TODO: ScopeFilter non rispetta ISP — extract() restituisce già remainingText,
// quindi removeFrom() è ridondante. Da valutare se separare in futuro.
class ScopeFilter implements SearchStrategyInterface<{ scope?: 'title' | 'content'; remainingText: string }> {
  getHints() {
    return [{ label: 'title:', desc: i18n.title }];
  }

  extract(query: string): { scope?: 'title' | 'content'; remainingText: string } {
    const titleMatch = query.match(/\btitle:\s*(\S+)/i);

    if (titleMatch) {
      const searchTerm = titleMatch[1];
      const remainingText = query.replace(/\btitle:\s*\S+/i, searchTerm).trim();

      return { scope: 'title', remainingText };
    }

    return { scope: undefined, remainingText: query };
  }

  // Rimuove il prefisso "title:" mantenendo il termine di ricerca come testo libero
  removeFrom(query: string): string {
    return query.replace(/\btitle:\s*/i, '').trim();
  }
}

class TaskFilter implements SearchStrategyInterface<'all' | 'todo' | 'done' | undefined> {
  getHints() {
    return [{ label: 'task:', desc: 'task' }];
  }

  extract(query: string): 'all' | 'todo' | 'done' | undefined {
    const lowerQuery = query.toLowerCase();

    if (/\btask-todo:\b/.test(lowerQuery)) return 'todo';
    if (/\btask-done:\b/.test(lowerQuery)) return 'done';
    if (/\btask:\b/.test(lowerQuery)) return 'all';

    return undefined;
  }

  removeFrom(query: string): string {
    return query
      .replace(/\btask-todo:\b/gi, '')
      .replace(/\btask-done:\b/gi, '')
      .replace(/\btask:\b/gi, '')
      .trim();
  }
}

export class SearchStrategyFactory {
  private static readonly strategies: SearchStrategyInterface<unknown>[] = [
    new TagsFilter(),
    new DateFilter(),
    new FileFilter(),
    new ScopeFilter(),
    new TaskFilter(),
  ];

  static getAllHints(): { label: string; desc: string }[] {
    return SearchStrategyFactory.strategies.flatMap(s => s.getHints());
  }
}
