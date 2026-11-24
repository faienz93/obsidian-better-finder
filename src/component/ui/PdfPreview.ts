import { App, TFile, loadPdfJs } from "obsidian";
import { DrawQueue } from "./DrawQueue";

// Wide enough for a Card on a high-density screen; the Modal shrinks it.
const PAGE_WIDTH_CSS_PX = 300;

/**
 * Draws the first page of a PDF as an image. An `![[x.pdf]]` embed mounts Obsidian's whole PDF
 * viewer, thumbnails of every page and a pdf.js worker of its own: a list of PDFs starts dozens of
 * workers at once and scrolling stalls. Here every PDF shares one worker and they are drawn one
 * at a time.
 */
export class PdfPreview {
  private static _instance: PdfPreview | null = null;
  private readonly queue = new DrawQueue();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private worker: any = null;

  private constructor(private app: App) {}

  public static getInstance(app: App): PdfPreview {
    if (!PdfPreview._instance) {
      PdfPreview._instance = new PdfPreview(app);
    }

    return PdfPreview._instance;
  }

  /** Stops the shared worker; called when the plugin unloads. */
  public static dispose(): void {
    PdfPreview._instance?.worker?.destroy();
    PdfPreview._instance = null;
  }

  /** Resolves once the page is drawn, or at once if `containerEl` left the page before its turn. */
  public draw(file: TFile, containerEl: HTMLElement): Promise<void> {
    return this.queue.add(() => this.drawFirstPage(file, containerEl), () => containerEl.isConnected);
  }

  private async drawFirstPage(file: TFile, containerEl: HTMLElement): Promise<void> {
    const pdfjs = await loadPdfJs();

    this.worker ??= new pdfjs.PDFWorker();

    const data = new Uint8Array(await this.app.vault.readBinary(file));
    const doc = await pdfjs.getDocument({ data, worker: this.worker }).promise;

    try {
      const page = await doc.getPage(1);
      const widthPx = PAGE_WIDTH_CSS_PX * Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: widthPx / page.getViewport({ scale: 1 }).width });
      const canvas = document.createElement('canvas');

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      // An <img>, so the image rules of the Card and the Modal apply as they do to pictures.
      containerEl.createEl('img', { cls: 'pdf-preview', attr: { src: canvas.toDataURL('image/png'), alt: file.name } });
    } finally {
      await doc.destroy();
    }
  }
}
