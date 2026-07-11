/**
 * Mock minimale del modulo "obsidian" per i test unitari.
 * Solo le superfici toccate dalla logica pura: le classi sono stub vuoti,
 * getAllTags legge il campo `tags` della cache finta.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export class TFile {}
export class TFolder {}
export class Component {}
export class Notice {
  constructor(_message?: string, _timeout?: number) { /* stub */ }
  setMessage(_message: string) { /* stub */ }
  hide() { /* stub */ }
}
export class Menu {}
export class Plugin {}
export class ItemView {}
export class SuggestModal {}
export class FileSystemAdapter {}
export class MarkdownRenderer {
  static render() { return Promise.resolve(); }
}

export const Platform = { isMobile: false };

export const setIcon = (_el: unknown, _icon: string): void => { /* stub */ };

export const getAllTags = (cache: any): string[] | null => cache?.tags ?? null;
