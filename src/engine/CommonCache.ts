import { TFile } from "obsidian";

/**
 * Stato derivato dal vault che va tenuto aggiornato quando i file cambiano.
 * Le tre implementazioni sono SearchIndex, CanvasTagCache e XbergExtractor.
 *
 * L'interfaccia copre solo la scrittura: come si legge una common cache resta
 * specifico di ciascuna, e le politiche in lettura divergono di proposito
 * (vedi "Deliberate asymmetry" in CONTEXT.md).
 *
 * Ogni cache possiede soltanto il proprio stato: se ne alimenta un'altra
 * (XbergExtractor scrive nell'indice) quella si ripulisce da sé, perché
 * main.ts notifica tutte le cache registrate.
 */
export interface CommonCache {
  /**
   * True se questo file appartiene alla cache. Sostituisce gli if sull'estensione.
   *
   * `oldPath` arriva valorizzato solo sul rename, dove il TFile porta già il
   * path nuovo: una cache che decide per path (non per estensione) deve poter
   * guardare quello vecchio, altrimenti non si riconosce il proprio file e si
   * lascia dietro la voce stantia.
   */
  handles(file: TFile, oldPath?: string): boolean;

  /**
   * True se gli aggiornamenti vanno lasciati correre in background invece di
   * essere attesi. Vale per chi fa lavoro lungo e non urgente: l'estrazione
   * via sidecar arriva a 60 s, e nessuna ricerca la aspetta.
   */
  readonly deferred?: boolean;

  onCreate(file: TFile): Promise<void>;

  /**
   * Il contenuto del file è cambiato. Riceve sia vault 'modify' sia
   * metadataCache 'changed': per il dominio significano la stessa cosa.
   */
  onUpdate(file: TFile): Promise<void>;

  onDelete(file: TFile): Promise<void>;

  /** Il file è lo stesso: ri-chiavare lo stato esistente, non ricalcolarlo. */
  onRename(file: TFile, oldPath: string): Promise<void>;
}
