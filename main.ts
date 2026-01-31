import { Plugin } from 'obsidian';
import FinderModal from './src/FinderModal'
import FinderSetting from './src/FinderSetting'
import { FinderView, FINDER_VIEW_TYPE } from './src/FinderView'

interface ObsidianBetterFinderSettings {
  mySetting: string;
}

const DEFAULT_SETTINGS: ObsidianBetterFinderSettings = {
  mySetting: 'default'
}

export default class ObsidianBetterFinder extends Plugin {
  settings: ObsidianBetterFinderSettings;

  async onload() {
    console.log("AdvancedSearch loaded 🚀");

    await this.loadSettings();

    // Register the FinderView
    this.registerView(FINDER_VIEW_TYPE, (leaf) => new FinderView(leaf));

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

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new FinderSetting(this.app, this));

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

  onunload() {

  }



  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }


}




