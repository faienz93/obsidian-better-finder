import { Platform, Plugin, TFile } from 'obsidian';
import FinderModal from './src/FinderModal'
import FinderSetting from './src/FinderSetting'
import { FinderCard, FINDER_VIEW_TYPE } from './src/FinderCard'
import { SearchIndex } from './src/engine/SearchIndex';
import { CanvasTagCache } from './src/engine/CanvasTagCache';
import { XbergExtractor, XBERG_EXTENSIONS } from './src/engine/XbergExtractor';
import { SearchHistory } from './src/engine/SearchHistory';

interface ObsidianBetterFinderSettings {
  mySetting: string;
  showRibbonIcon: boolean;
  searchHistory: string[];
}

const DEFAULT_SETTINGS: ObsidianBetterFinderSettings = {
  mySetting: 'default',
  showRibbonIcon: true,
  searchHistory: []
}

export default class ObsidianBetterFinder extends Plugin {
  private fileCache: TFile[] = [];
  settings: ObsidianBetterFinderSettings;
  private ribbonIconEl: HTMLElement | null = null;
  private searchIndex: SearchIndex;

  async onload() {
    console.log("AdvancedSearch loaded 🚀");

    if (!Platform.isMobile) {
      console.log('Plugin runned from Mobile!')
    }

    await this.loadSettings();

    // Cronologia ricerche: carica le voci salvate e collega la persistenza
    SearchHistory.getInstance().init(this.settings.searchHistory, (entries) => {
      this.settings.searchHistory = entries;
      void this.saveSettings();
    });

    // Register the FinderView
    this.registerView(FINDER_VIEW_TYPE, (leaf) => new FinderCard(leaf));

    this.addCommand({
      id: 'obsidian-better-finder-open-modal',
      name: 'Open Better Finder Modal',
      // Hot key
      // hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'a' }],
      callback: () => {
        new FinderModal(this.app).open();
      }
    });

    this.addCommand({
      id: 'open-finder-view',
      name: 'Open Better Finder View',
      callback: () => this.activateFinderView()
    });

    // Add ribbon icon in the left sidebar (if enabled in settings)
    if (this.settings.showRibbonIcon) {
      this.addRibbonIconEl();
    }

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new FinderSetting(this.app, this));

    this.app.workspace.onLayoutReady(async () => {
      this.searchIndex = SearchIndex.getInstance(this.app);
      await this.searchIndex.buildIndex();

      // Cache dei tag nei canvas (non passano dal metadataCache)
      const canvasTagCache = CanvasTagCache.getInstance(this.app);

      await canvasTagCache.buildCache();

      // Estrazione PDF/OCR via Xberg: parte in background, non blocca l'avvio.
      // Se il binario non è installato l'extractor si disattiva da solo.
      const xbergExtractor = XbergExtractor.getInstance(this.app);

      void xbergExtractor.indexAll();

      this.registerEvent(
        this.app.vault.on('create', async (file) => {
          if (file instanceof TFile) {
            this.fileCache.push(file);

            // Aggiungi all'indice se è markdown
            if (file.extension === 'md') {
              await this.searchIndex.updateFile(file);
            }

            if (file.extension === 'canvas') {
              await canvasTagCache.updateFile(file);
            }

            if (XBERG_EXTENSIONS.includes(file.extension.toLowerCase())) {
              void xbergExtractor.indexFile(file);
            }
          }
        })
      );

      // File CANCELLATO
      this.registerEvent(
        this.app.vault.on('delete', (file) => {
          if (file instanceof TFile) {
            const index = this.fileCache.indexOf(file);

            if (index > -1) {
              this.fileCache.splice(index, 1);
            }

            this.searchIndex.removeFile(file);
            canvasTagCache.removeFile(file.path);
          }
        })
      );

      // File RINOMINATO
      this.registerEvent(
        this.app.vault.on('rename', async (file, oldPath) => {
          if (file instanceof TFile) {
            // La reference del file rimane la stessa, aggiorna solo l'indice
            await this.searchIndex.renameFile(file, oldPath);

            if (file.extension === 'canvas') {
              await canvasTagCache.renameFile(file, oldPath);
            }

            if (XBERG_EXTENSIONS.includes(file.extension.toLowerCase())) {
              void xbergExtractor.indexFile(file);
            }
          }
        })
      );

      // I canvas non emettono metadataCache 'changed': serve vault 'modify'
      this.registerEvent(
        this.app.vault.on('modify', async (file) => {
          if (file instanceof TFile && file.extension === 'canvas') {
            await canvasTagCache.updateFile(file);
          }
        })
      );

      // File MODIFICATO (contenuto cambiato)
      // Usiamo metadataCache.on('changed') invece di vault.on('modify')
      // perché è più affidabile per i markdown
      this.registerEvent(
        this.app.metadataCache.on('changed', async (file: TFile) => {
          // Aggiorna l'indice con il nuovo contenuto
          await this.searchIndex.updateFile(file);
        })
      );
    })
  }

  async activateFinderView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(FINDER_VIEW_TYPE)[0];

    if (!leaf) {
      leaf = workspace.getLeaf(true);
      await leaf.setViewState({ type: FINDER_VIEW_TYPE, active: true });
    }

    workspace.revealLeaf(leaf);
  }

  addRibbonIconEl() {
    this.ribbonIconEl = this.addRibbonIcon('search', 'Open Better Finder', () => {
      this.activateFinderView();
    });
  }

  removeRibbonIconEl() {
    if (this.ribbonIconEl) {
      this.ribbonIconEl.remove();
      this.ribbonIconEl = null;
    }
  }

  onunload() {

  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
