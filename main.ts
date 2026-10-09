import { Platform, Plugin, TAbstractFile, TFile } from 'obsidian';
import FinderModal from './src/FinderModal'
import FinderSetting from './src/FinderSetting'
import { FinderCard, FINDER_VIEW_TYPE } from './src/FinderCard'
import { SearchIndex } from './src/engine/SearchIndex';
import { CanvasTagCache } from './src/engine/CanvasTagCache';
import { XbergExtractor } from './src/engine/XbergExtractor';
import { SearchHistory } from './src/engine/SearchHistory';
import { CommonCache } from './src/engine/CommonCache';

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
      this.saveSettings().catch(console.error);
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

      xbergExtractor.indexAll().catch(console.error);

      // The three common caches share one interface (src/engine/CommonCache.ts),
      // so the handlers below no longer know which extension belongs to whom:
      // handles() decides. Adding a cache means adding it to this list.
      // Order is not significant — on rename the index discards the old path
      // while the extractor re-adds the new one, different keys that commute.
      const caches: CommonCache[] = [this.searchIndex, canvasTagCache, xbergExtractor];

      const dispatch = async (
        file: TAbstractFile,
        apply: (cache: CommonCache, file: TFile) => Promise<void>,
        oldPath?: string,
      ): Promise<void> => {
        if (!(file instanceof TFile)) return;

        for (const cache of caches) {
          if (!cache.handles(file, oldPath)) continue;

          const onFailure = (error: unknown) =>
            console.error('[BetterFinder] Cache update failed:', error);

          if (cache.deferred) {
            apply(cache, file).catch(onFailure);

            continue;
          }

          try {
            await apply(cache, file);
          } catch (error) {
            onFailure(error);
          }
        }
      };

      this.registerEvent(
        this.app.vault.on('create', async (file) => {
          if (file instanceof TFile) {
            this.fileCache.push(file);
          }

          await dispatch(file, (cache, f) => cache.onCreate(f));
        })
      );

      this.registerEvent(
        this.app.vault.on('delete', async (file) => {
          if (file instanceof TFile) {
            const index = this.fileCache.indexOf(file);

            if (index > -1) {
              this.fileCache.splice(index, 1);
            }
          }

          await dispatch(file, (cache, f) => cache.onDelete(f));
        })
      );

      this.registerEvent(
        this.app.vault.on('rename', async (file, oldPath) => {
          await dispatch(file, (cache, f) => cache.onRename(f, oldPath), oldPath);
        })
      );

      // "Contents changed" comes from two non-overlapping sources: markdown via
      // metadataCache 'changed' (more reliable, the original choice), everything
      // else via vault 'modify' — canvases never reach the metadataCache.
      // Routing markdown to both would re-read and re-index it twice per save.
      this.registerEvent(
        this.app.vault.on('modify', async (file) => {
          if (file instanceof TFile && file.extension === 'md') return;

          await dispatch(file, (cache, f) => cache.onUpdate(f));
        })
      );

      this.registerEvent(
        this.app.metadataCache.on('changed', async (file: TFile) => {
          await dispatch(file, (cache, f) => cache.onUpdate(f));
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
