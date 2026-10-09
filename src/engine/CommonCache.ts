import { TFile } from "obsidian";

/**
 * State derived from the Vault that must be kept current as files change,
 * implemented by SearchIndex, CanvasTagCache and XbergExtractor.
 *
 * Write side only: how a common cache answers a read stays its own, and the
 * three policies diverge on purpose (see "Deliberate asymmetry" in CONTEXT.md).
 * Each cache owns only its own state — main.ts notifies every registered one.
 */
export interface CommonCache {
  /**
   * True if this file belongs to the cache. Replaces the if-on-extension
   * checks that used to live in the event handlers.
   *
   * `oldPath` is set on rename only, where the TFile already carries the new
   * path: a cache keyed by path would not recognise its own file otherwise,
   * and would leave the stale entry behind.
   */
  handles(file: TFile, oldPath?: string): boolean;

  /**
   * True if updates should run in the background instead of being awaited.
   * Extraction shells out to a sidecar for up to 60s and no search waits on it.
   */
  readonly deferred?: boolean;

  onCreate(file: TFile): Promise<void>;

  /**
   * Contents changed. Receives both vault 'modify' and metadataCache
   * 'changed': to the domain they mean the same thing.
   */
  onUpdate(file: TFile): Promise<void>;

  onDelete(file: TFile): Promise<void>;

  /** Same file: re-key the existing state rather than recomputing it. */
  onRename(file: TFile, oldPath: string): Promise<void>;
}
